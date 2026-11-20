# Pré-remplissage du profil depuis le CV (JOB-071) : le texte du CV importé (PDF ou DOCX) est lu
# sur le serveur, et des valeurs du profil en sont tirées. Ce ne sont que des suggestions :
# l'étudiant choisit celles qu'il garde, puis les enregistre par PATCH /api/student/<id>.
# Rien n'est enregistré ici. Contrat : docs/api/resume.md
import html
import io
import logging
import re
import unicodedata
import zipfile
from collections.abc import Iterable
from typing import Any

from django.db.models.fields.files import FieldFile
from pypdf import PdfReader
from rest_framework.decorators import api_view
from rest_framework.request import Request
from rest_framework.response import Response

from .api import getStudent
from .models import Student, User
from .profile import (
    SKILL_MAX_LENGTH,
    SKILLS_MAX,
    SKILLS_STORED_MAX_LENGTH,
    canEditStudent,
)

logger = logging.getLogger(__name__)

# Le début du CV suffit : son en-tête, sa formation et ses compétences
MAX_PAGES = 5
MAX_TEXT_LENGTH = 40_000
# Texte du document Word une fois décompressé : au-delà, le fichier n'est pas un CV
MAX_DOCX_XML = 5 * 1024 * 1024
# Un CV fait 5 Mo au plus (resume.py)
MAX_FILE_SIZE = 5 * 1024 * 1024

# ----- Lecture du texte ----- #


def pdfText(content: bytes) -> str:
    # pypdf limite déjà chaque flux décompressé (75 Mo) ; seules les premières pages sont lues
    reader = PdfReader(io.BytesIO(content), strict=False)
    if reader.is_encrypted and not reader.decrypt(""):
        return ""
    parts: list[str] = []
    length = 0
    for page in reader.pages[:MAX_PAGES]:
        text = page.extract_text() or ""
        parts.append(text)
        length += len(text)
        if length > MAX_TEXT_LENGTH:
            break
    return "\n".join(parts)[:MAX_TEXT_LENGTH]


# Paragraphes et morceaux de texte de word/document.xml, lus sans analyseur XML : le fichier
# vient de l'étudiant, et ni ses entités ni sa DTD ne sont interprétées
PARAGRAPH = re.compile(r"<w:p[ >].*?</w:p>", re.S)
TEXT_RUN = re.compile(r"<w:t(?:\s[^>]*)?>([^<]*)</w:t>")
TAB = re.compile(r"<w:tab\b[^>]*/>")


def docxText(content: bytes) -> str:
    with zipfile.ZipFile(io.BytesIO(content)) as archive:
        with archive.open("word/document.xml") as document:
            xml = document.read(MAX_DOCX_XML + 1)
    if len(xml) > MAX_DOCX_XML:
        return ""
    lines = []
    for paragraph in PARAGRAPH.findall(xml.decode("utf-8", errors="ignore")):
        paragraph = TAB.sub("<w:t> </w:t>", paragraph)
        lines.append("".join(html.unescape(run) for run in TEXT_RUN.findall(paragraph)))
    return "\n".join(lines)[:MAX_TEXT_LENGTH]


def resumeText(resume: FieldFile) -> str:
    # Texte du CV, ou "" quand il ne se lit pas : ancien format Word (.doc), PDF scanné ou
    # protégé, fichier abîmé. Le format est lu dans le contenu, comme à l'import.
    try:
        with resume.open("rb") as file:
            content = file.read(MAX_FILE_SIZE + 1)
        if len(content) > MAX_FILE_SIZE:
            return ""
        if content.startswith(b"%PDF-"):
            return pdfText(content)
        if content.startswith(b"PK\x03\x04"):
            return docxText(content)
    except Exception:  # noqa: BLE001
        # pypdf et zipfile lèvent toutes sortes d'erreurs sur un fichier abîmé
        logger.info("CV %s not readable", resume.name, exc_info=True)
    return ""


# ----- Valeurs tirées du texte ----- #


def fold(text: str) -> str:
    # Sans casse ni accents, pour comparer : « Île-de-France » donne « ile-de-france »
    decomposed = unicodedata.normalize("NFKD", text.casefold().replace("’", "'"))
    return "".join(char for char in decomposed if not unicodedata.combining(char))


def cleanLines(text: str) -> list[str]:
    return [" ".join(line.split()) for line in text.splitlines() if line.strip()]


# Bords d'un texte extrait d'une ligne : séparateurs et ponctuation
EDGES = " -–—|•·:,;/()."


# Niveaux d'études (StudyDegree : Bac + 1 à Bac + 5), cherchés dans le texte sans accents.
# « BUT » est cherché en majuscules : sinon, le mot « but » (« dans le but de ») compterait.
DEGREES: list[tuple[re.Pattern[str], int]] = [
    (re.compile(r"\b(?:master\s*2|m2)\b"), 5),
    (re.compile(r"\b(?:master\s*1|m1)\b"), 4),
    # « Master » et « Licence » sans année : celles qui ont la leur sont comptées au-dessus
    (
        re.compile(
            r"\b(?:master(?!\s*[12]\b)|mastere|mba|msc|diplome d'ingenieur"
            r"|cycle (?:d')?ingenieur|ecole d'ingenieurs?)\b"
        ),
        5,
    ),
    (re.compile(r"\b(?:licence\s*3|l3|licence pro(?:fessionnelle)?|bachelor)\b"), 3),
    (re.compile(r"\b(?:licence\s*2|l2|bts|dut|deust)\b"), 2),
    (re.compile(r"\b(?:licence\s*1|l1)\b"), 1),
    (re.compile(r"\blicence(?!\s*[12]\b)\b"), 3),
]
BAC_PLUS = re.compile(r"\bbac\s*\+\s*([1-5])\b")
BUT = re.compile(r"\bBUT\b")


def degreeOf(line: str) -> int | None:
    # Niveau le plus élevé cité par la ligne
    folded = fold(line)
    levels = [int(level) for level in BAC_PLUS.findall(folded)]
    levels += [level for pattern, level in DEGREES if pattern.search(folded)]
    if BUT.search(line):
        levels.append(3)
    return max(levels) if levels else None


MONTH = (
    r"(?:janv(?:ier)?|f[ée]vr?(?:ier)?|mars|avr(?:il)?|mai|juin|juil(?:let)?|ao[uû]t"
    r"|sept(?:embre)?|oct(?:obre)?|nov(?:embre)?|d[ée]c(?:embre)?)\.?"
)
# Période d'une formation, retirée de sa ligne : « (2025-2027) », « Sept. 2024 – aujourd'hui »
PERIOD = re.compile(
    rf"\(?\s*(?:(?:depuis|de|du|en)\s+)?(?:{MONTH}\s+)?(?:19|20)\d{{2}}"
    rf"(?:\s*[-–—/à]\s*(?:(?:{MONTH}\s+)?(?:19|20)\d{{2}}|aujourd['’]hui|pr[ée]sent|en cours))?\s*\)?",
    re.I,
)


def education(lines: list[str]) -> tuple[str, int] | None:
    # Ligne du diplôme le plus élevé, sans ses dates (« Master MIAGE — Université Paris
    # Nanterre »), et son niveau. Une phrase (l'objectif du CV) n'est pas une formation.
    best: tuple[str, int] | None = None
    for line in lines:
        level = degreeOf(line)
        if level is None or (best is not None and level <= best[1]):
            continue
        if len(line) > 140 or "recherche" in fold(line):
            continue
        text = " ".join(PERIOD.sub(" ", line).split()).strip(EDGES)
        if len(text) > 100:
            text = text[:100].rsplit(" ", 1)[0].strip(EDGES)
        if len(text) >= 3:
            best = (text, level)
    return best


POSITION_LABEL = re.compile(
    r"^(?:poste recherch[ée]e?|objectif(?: professionnel)?|projet professionnel)\s*[:\-–]\s*(?P<p>.+)$",
    re.I,
)
POSITION_SENTENCE = re.compile(
    r"(?:recherche|à la recherche|en recherche)\s+(?:d['’]une?\s+|une?\s+)?"
    r"(?:alternance|apprentissage|contrat d['’]apprentissage|contrat de professionnalisation|stage)"
    r"(?:\s+de\s+\d+\s+(?:mois|ans?))?\s+(?:en\s+tant\s+que|comme|en|de|d['’])\s*(?P<p>[^.,;:!?()]+)",
    re.I,
)
# Titre du CV : « Développeur Full Stack en alternance »
POSITION_TITLE = re.compile(r"^(?P<p>[^.,;:!?()]{3,80}?)\s+en\s+alternance\b", re.I)
# Ce qui suit le poste dans une phrase
POSITION_END = re.compile(
    r"\s+(?:à partir|a partir|dès|des le|pour|pendant|sur une|d['’]une durée|au sein|selon|avec|dans)\b.*$",
    re.I,
)
# Débuts de ligne qui ne sont pas un poste : « Étudiant en Master… en alternance »
NOT_A_POSITION = {
    "actuellement",
    "contrat",
    "disponible",
    "en",
    "etudiant",
    "etudiante",
    "formation",
    "j",
    "je",
    "poste",
    "recherche",
    "rythme",
    "un",
    "une",
}


def cleanPosition(text: str) -> str | None:
    text = POSITION_END.sub("", text).strip(EDGES)
    words = text.split()
    if not words or len(words) > 8 or len(text) > 100:
        return None
    if fold(words[0]).split("'")[0] in NOT_A_POSITION:
        return None
    return text[0].upper() + text[1:]


def position(lines: list[str]) -> str | None:
    # Une étiquette (« Poste recherché : ») ou une phrase (« je recherche une alternance en… »)
    # l'emporte sur le titre du CV
    title: str | None = None
    for line in lines:
        match = POSITION_LABEL.match(line) or POSITION_SENTENCE.search(line)
        if match is not None:
            found = cleanPosition(match.group("p"))
            if found:
                return found
        elif title is None and (match := POSITION_TITLE.match(line)):
            title = cleanPosition(match.group("p"))
    return title


# Compétences reconnues, en plus de celles déjà saisies par les étudiants (l'orthographe des
# filtres des recruteurs). Les mots courants du français (« vue », « agile »…) et les noms
# d'une lettre (C, R) n'y sont pas : ils seraient trouvés partout.
KNOWN_SKILLS = [
    # Langages et frameworks
    "Python", "Java", "JavaScript", "TypeScript", "C++", "C#", "PHP", "Ruby", "Kotlin", "Swift",
    "Rust", "Scala", "Dart", "SQL", "PL/SQL", "NoSQL", "HTML", "CSS", "Sass", "Bash",
    "React", "React Native", "Angular", "Vue.js", "Next.js", "Node.js", "Express", "Django",
    "Flask", "FastAPI", "Spring", "Spring Boot", "Symfony", "Laravel", ".NET", "Flutter",
    "Tailwind CSS", "Bootstrap", "jQuery", "GraphQL",
    # Données et IA
    "PostgreSQL", "MySQL", "MongoDB", "Oracle", "Redis", "Elasticsearch", "Pandas", "NumPy",
    "Scikit-learn", "TensorFlow", "PyTorch", "Machine Learning", "Deep Learning", "MATLAB",
    "Power BI", "Tableau", "Looker", "Spark", "Hadoop", "Airflow",
    # Outils et infrastructure
    "Git", "GitHub", "GitLab", "Docker", "Kubernetes", "Linux", "AWS", "Azure",
    "Google Cloud", "Terraform", "Jenkins", "Ansible", "Jira", "Confluence", "Notion",
    "Scrum", "Kanban", "UML", "Wireshark", "Selenium", "Cypress", "Postman",
    # Bureautique, gestion, marketing
    "Excel", "VBA", "Word", "PowerPoint", "Outlook", "SAP", "Salesforce", "HubSpot",
    "Google Analytics", "SEO", "SEA", "Google Ads", "WordPress", "Shopify", "Sage", "Cegid",
    # Design et ingénierie
    "Figma", "Adobe XD", "Photoshop", "Illustrator", "InDesign", "Premiere Pro",
    "After Effects", "Canva", "Blender", "AutoCAD", "SolidWorks", "CATIA", "Revit",
]  # fmt: skip
# Noms qui ne comptent qu'écrits avec leur majuscule : en minuscules, ce sont des mots courants
CASE_SENSITIVE = {"Express", "Notion", "Oracle", "Sage", "Tableau", "Word"}
# Compétences saisies par des étudiants, jamais cherchées : mots courants du français
COMMON_WORDS = {"agile", "go", "vue"}


def knownSkills() -> list[str]:
    # Les compétences de la liste, puis celles des étudiants : l'orthographe déjà utilisée
    # dans les filtres des recruteurs l'emporte sur celle de la liste
    skills = {fold(skill): skill for skill in KNOWN_SKILLS}
    stored = Student.objects.exclude(skills="").values_list("skills", flat=True)
    for value in stored[:2000]:
        for skill in value.split(","):
            skill = " ".join(skill.split())
            key = fold(skill)
            if 2 <= len(skill) <= SKILL_MAX_LENGTH and key not in COMMON_WORDS:
                skills[key] = skill
    return list(skills.values())


def skillsIn(text: str, vocabulary: Iterable[str]) -> list[str]:
    # Les compétences citées, dans l'ordre du CV. Le nom entier : « Java » n'est pas dans
    # « JavaScript ». Les plus longues d'abord, et leur texte est masqué, pour que « Spring »
    # ne soit pas trouvé une seconde fois dans « Spring Boot ».
    texts = {True: fold(text), False: text}
    found: list[tuple[int, str]] = []
    for skill in sorted(set(vocabulary), key=len, reverse=True):
        folded = skill not in CASE_SENSITIVE
        name = re.escape(fold(skill) if folded else skill)
        pattern = re.compile(rf"(?<![\w+#.]){name}(?![\w+#]|\.\w)")
        matches = list(pattern.finditer(texts[folded]))
        if not matches:
            continue
        found.append((matches[0].start(), skill))
        masked = list(texts[folded])
        for match in matches:
            masked[match.start() : match.end()] = " " * (match.end() - match.start())
        texts[folded] = "".join(masked)
    kept: list[str] = []
    for _, skill in sorted(found):
        if len(kept) == SKILLS_MAX:
            break
        if len(", ".join([*kept, skill])) <= SKILLS_STORED_MAX_LENGTH:
            kept.append(skill)
    return kept


# Régions et grandes villes, pour la région où l'étudiant cherche : la première citée, en
# général celle de son adresse en tête du CV
REGIONS = {
    "Île-de-France": [
        "ile-de-france", "ile de france", "paris", "nanterre", "creteil", "versailles",
        "saint-denis", "boulogne-billancourt", "montreuil", "cergy", "evry", "massy",
        "argenteuil", "vincennes", "orsay", "la defense",
    ],
    "Auvergne-Rhône-Alpes": [
        "auvergne-rhone-alpes", "lyon", "grenoble", "saint-etienne", "clermont-ferrand",
        "annecy", "villeurbanne", "chambery",
    ],
    "Provence-Alpes-Côte d’Azur": [
        "provence-alpes-cote d'azur", "paca", "marseille", "nice", "toulon",
        "aix-en-provence", "avignon", "sophia antipolis",
    ],
    "Occitanie": ["occitanie", "toulouse", "montpellier", "nimes", "perpignan"],
    "Nouvelle-Aquitaine": ["nouvelle-aquitaine", "bordeaux", "limoges", "poitiers", "la rochelle"],
    "Hauts-de-France": ["hauts-de-france", "lille", "amiens", "roubaix", "villeneuve-d'ascq"],
    "Grand Est": ["grand est", "strasbourg", "reims", "metz", "nancy", "mulhouse"],
    "Pays de la Loire": ["pays de la loire", "nantes", "angers", "le mans"],
    "Bretagne": ["bretagne", "rennes", "brest", "vannes", "lorient"],
    "Normandie": ["normandie", "rouen", "caen", "le havre"],
    "Bourgogne-Franche-Comté": ["bourgogne-franche-comte", "dijon", "besancon"],
    "Centre-Val de Loire": ["centre-val de loire", "orleans"],
    "Corse": ["corse", "ajaccio", "bastia"],
}  # fmt: skip
REGION_PATTERNS = [
    (re.compile(rf"(?<![\w-]){re.escape(name)}(?![\w-])"), region)
    for region, names in REGIONS.items()
    for name in names
]


def regionIn(text: str) -> str | None:
    folded = fold(text)
    found = [
        (match.start(), region)
        for pattern, region in REGION_PATTERNS
        if (match := pattern.search(folded))
    ]
    return min(found)[1] if found else None


def suggestionsFrom(text: str, vocabulary: Iterable[str]) -> dict[str, Any]:
    # Seules les valeurs trouvées : un champ absent n'a rien donné
    lines = cleanLines(text)
    suggestions: dict[str, Any] = {}
    if found := position(lines):
        suggestions["desired_position"] = found
    if degree := education(lines):
        suggestions["education"], suggestions["study_degree"] = degree
    if skills := skillsIn(text, vocabulary):
        suggestions["skills"] = skills
    if region := regionIn(text):
        suggestions["region"] = region
    return suggestions


# ----- API ----- #


@api_view(["GET"])
def student_resume_suggestions(request: Request, id: int) -> Response:
    # Réservé à l'étudiant : son CV n'est lu que pour lui
    user: User = request.user
    if not canEditStudent(user, id):
        return Response({"error": "Forbidden"}, status=403)
    target = getStudent(id)
    if target is None:
        return Response({"error": "Student not found"}, status=404)
    if not target.resume:
        return Response({"error": "Resume not found"}, status=404)
    text = resumeText(target.resume)
    if not text.strip():
        return Response({"readable": False, "suggestions": {}})
    return Response(
        {"readable": True, "suggestions": suggestionsFrom(text, knownSkills())}
    )
