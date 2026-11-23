"""Extract bounded CV text and compare it with offer requirements or role keywords."""

import io
import re
import zipfile
from dataclasses import dataclass
from xml.etree import ElementTree

from pypdf import PdfReader

from .conversations import normalize
from .models import Offer, Student

MAX_FILE = 5 * 1024 * 1024
MAX_XML = 2 * 1024 * 1024
STOP_WORDS = frozenset(
    "avec dans pour une des les qui que sur par vous nous votre vos notre leur aux"
    " est sont avoir etre dans plus bonne bon connaissances experience competences"
    " recherche recherchee profil poste maitrise anglais francais niveau"
    " alternance stage junior confirme debutant"
    " the and for with from you your our required experience skills knowledge".split()
)
GENERIC_TITLE_TERMS = frozenset(
    "developpeur developer ingenieur engineer assistant charge responsable chef"
    " technicien consultant manager analyst analyste offre emploi recrute"
    " cdi cdd fullstack frontend backend full stack remote".split()
)
SHORT_TERMS = frozenset(
    {"ai", "bi", "c#", "go", "ia", "it", "js", "qa", "rh", "ts", "ui", "ux"}
)
GENDERED_SUFFIXES = (
    ("developpeuse", "developpeur"),
    ("cheffe", "chef"),
    ("assistante", "assistant"),
    ("chargee", "charge"),
    ("technicienne", "technicien"),
    ("ingenieure", "ingenieur"),
    ("conceptrice", "concepteur"),
    ("administratrice", "administrateur"),
    ("coordinatrice", "coordinateur"),
    ("directrice", "directeur"),
    ("manageuse", "manager"),
    ("commerciale", "commercial"),
    ("consultante", "consultant"),
)
_CV_CACHE: dict[tuple[int | None, str, object], str] = {}


def canonical_word(word: str) -> str:
    for feminine, masculine in GENDERED_SUFFIXES:
        if word == feminine:
            return masculine
    return word


def comparable_text(text: str) -> str:
    cleaned = normalize(text).replace("-", " ").replace("'", " ").replace("’", " ")
    return " ".join(canonical_word(word) for word in cleaned.split())


def position_matches(desired_position: str, offer_title: str) -> bool:
    position = comparable_text(desired_position)
    title = comparable_text(offer_title)
    if not position or not title:
        return False
    if f" {position} " in f" {title} " or f" {title} " in f" {position} ":
        return True
    pos_terms = terms(position)
    title_terms = terms(title)
    return bool(
        pos_terms
        and title_terms
        and (pos_terms <= title_terms or title_terms <= pos_terms)
    )


def terms(text: str) -> set[str]:
    words = re.findall(r"[a-z0-9]+(?:[+#.][a-z0-9]+)*[+#]*", normalize(text).lower())
    result: set[str] = set()
    for raw in words:
        word = canonical_word(raw.strip("."))
        if (len(word) >= 3 or word in SHORT_TERMS) and word not in STOP_WORDS:
            result.add(word)
    return result


def offer_keywords(offer: Offer) -> tuple[set[str], int]:
    requirements = terms(offer.requirements)
    if requirements:
        return requirements, 50
    return terms(offer.title) - GENERIC_TITLE_TERMS, 25


def student_terms(student: Student, resume_text: str | None = None) -> set[str]:
    extracted = cv_text(student) if resume_text is None else resume_text
    return terms(f"{student.skills} {extracted}")


@dataclass(frozen=True)
class OfferMatch:
    category: bool
    position: bool
    keywords: list[str]
    percentage: int


def match_offer(
    student: Student,
    offer: Offer,
    candidate_terms: set[str],
    skill_criteria: tuple[set[str], int],
) -> OfferMatch:
    category = student.category is not None and student.category == offer.category
    position = position_matches(student.desired_position, offer.title)
    offer_terms, max_skill_points = skill_criteria
    keywords = sorted(candidate_terms & offer_terms)
    # Title keywords provide weaker evidence than explicit requirements.
    skill_points = (
        max(1, round(max_skill_points * len(keywords) / len(offer_terms)))
        if keywords
        else 0
    )
    percentage = 20 * int(category) + 30 * int(position) + skill_points
    return OfferMatch(category, position, keywords, percentage)


def _extract_cv_text(student: Student) -> str:
    if not student.resume:
        return ""
    try:
        with student.resume.open("rb") as source:
            data = source.read(MAX_FILE + 1)
        if len(data) > MAX_FILE:
            return ""
        if data.startswith(b"%PDF-"):
            reader = PdfReader(io.BytesIO(data))
            if reader.is_encrypted:
                return ""
            return " ".join(page.extract_text() or "" for page in reader.pages[:10])
        if data.startswith(b"PK\x03\x04"):
            with zipfile.ZipFile(io.BytesIO(data)) as archive:
                info = archive.getinfo("word/document.xml")
                if info.file_size > MAX_XML:
                    return ""
                with archive.open(info) as doc:
                    xml_bytes = doc.read(MAX_XML + 1)
                if len(xml_bytes) > MAX_XML or b"<!ENTITY" in xml_bytes.upper():
                    return ""
                root = ElementTree.fromstring(xml_bytes)
                return " ".join(root.itertext())
    except Exception:  # Damaged, missing or unsupported CVs do not block suggestions.
        return ""
    return ""


def cv_text(student: Student) -> str:
    if not student.resume:
        return ""
    cache_key = (student.pk, student.resume.name, student.resume_updated_at)
    if student.pk is not None and cache_key in _CV_CACHE:
        return _CV_CACHE[cache_key]
    extracted = _extract_cv_text(student)
    if student.pk is not None and len(_CV_CACHE) < 1024:
        _CV_CACHE[cache_key] = extracted
    return extracted
