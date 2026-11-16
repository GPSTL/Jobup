# Pièces jointes des messages (JOB-043, REC-14) : la politique (formats, taille) et la
# vérification d'un fichier reçu. Le stockage est dans models.py (MessageAttachment), l'envoi
# et le téléchargement dans conversations.py. Contrat : docs/api/message_attachments.md
#
# Politique actuelle (questions ouvertes de JOB-043) :
#   - formats : PDF, DOCX et DOC, reconnus au contenu et non au nom ;
#   - taille : 10 Mo au plus ;
#   - nombre : un fichier par message ;
#   - un message peut ne contenir que le fichier ;
#   - suppression : le fichier disparaît avec son message ; aucune analyse antivirus.
import os

from django.core.files.uploadedfile import UploadedFile

from .resume import OLE2_SIGNATURE, isWordArchive

ATTACHMENT_MAX_SIZE = 10 * 1024 * 1024
# Nom affiché, extension comprise : le chemin complet tient dans les 255 caractères du champ
ATTACHMENT_NAME_MAX_LENGTH = 100
# Extension de chaque format accepté et type de contenu sous lequel il est téléchargé
ATTACHMENT_TYPES = {
    "pdf": "application/pdf",
    "doc": "application/msword",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}

SIZE_ERROR = "Le fichier ne doit pas dépasser 10 Mo."
FORMAT_ERROR = "Le fichier doit être au format PDF, DOCX ou DOC."
EMPTY_ERROR = "Le fichier est vide."
STORAGE_ERROR = (
    "Le message n’a pas été envoyé : le fichier n’a pas pu être enregistré. "
    "Réessayez dans un instant."
)


def attachmentFormat(upload: UploadedFile) -> str | None:
    # Extension du format, lue dans le contenu quel que soit le nom du fichier ;
    # None quand ce n'est ni un PDF ni un document Word
    start: bytes = upload.read(8)
    upload.seek(0)
    if start.startswith(b"%PDF-"):
        return "pdf"
    if start.startswith(OLE2_SIGNATURE):
        return "doc"
    if start.startswith(b"PK\x03\x04"):
        # Taille déjà vérifiée : l'archive tient en mémoire
        content = upload.read()
        upload.seek(0)
        return "docx" if isWordArchive(content) else None
    return None


def attachmentRefusal(upload: UploadedFile) -> tuple[str | None, str | None]:
    # (extension, None) quand le fichier est accepté, (None, message en français) sinon
    if upload.size is None or upload.size == 0:
        return None, EMPTY_ERROR
    if upload.size > ATTACHMENT_MAX_SIZE:
        return None, SIZE_ERROR
    extension = attachmentFormat(upload)
    if extension is None:
        return None, FORMAT_ERROR
    return extension, None


def attachmentName(uploaded: str, extension: str) -> str:
    # Nom conservé, raccourci, avec l'extension de son format ajoutée quand le nom ne s'y
    # termine pas (« Offre.doc » contenant un PDF devient « Offre.doc.pdf »). Le stockage
    # remplace ensuite les espaces par des soulignés et retire les autres caractères spéciaux.
    stem, suffix = os.path.splitext(uploaded.strip())
    if suffix.lower() != f".{extension}":
        stem, suffix = stem + suffix, f".{extension}"
    return stem[: ATTACHMENT_NAME_MAX_LENGTH - len(suffix)] + suffix
