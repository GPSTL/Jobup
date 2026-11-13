from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.contrib.staticfiles.views import serve
from django.urls import path, re_path

from jobup import api, candidates, exclusions, shortlist
from jobup.conversations import (
    conversation_messages,
    message_attachment,
    student_conversations,
)
from jobup.profile import student, student_photo
from jobup.resume import student_resume

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/csrf", api.csrf),
    path("api/signup", api.signup),
    path("api/login", api.api_login),
    path("api/logout", api.api_logout),
    path("api/me", api.me),
    path("api/student/<int:id>", student),
    path("api/student/<int:id>/photo", student_photo),
    path("api/student/<int:id>/resume", student_resume),
    path("api/student/conversations", student_conversations),
    path("api/applications", api.applications),
    path("api/applications/draft", api.application_draft),
    path("api/applications/<int:id>", api.application),
    path("api/applications/<int:id>/submit", api.application_submit),
    path("api/applications/<int:id>/documents/<slug:kind>", api.application_document),
    path("api/conversations/<int:id>/messages", conversation_messages),
    path(
        "api/conversations/<int:id>/messages/<int:message_id>/attachment",
        message_attachment,
    ),
    path("api/recruiter/candidates", candidates.candidate_list),
    path("api/recruiter/candidates/filters", candidates.candidate_filters),
    path("api/recruiter/candidates/<int:id>", candidates.candidate_detail),
    path("api/recruiter/candidates/<int:id>/cv", candidates.candidate_cv),
    path("api/recruiter/candidates/<int:id>/shortlist", shortlist.shortlist_candidate),
    path("api/recruiter/candidates/<int:id>/exclusion", exclusions.exclude_candidate),
    path("api/recruiter/shortlist", shortlist.shortlist),
    re_path(r"^(?!api)[^.]*$", serve, kwargs={"path": "index.html"}),
    path("favicon.ico", serve, kwargs={"path": "favicon.ico"}),
]

# Uploaded files (photos), served by Django only in development
urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
