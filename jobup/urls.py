from django.contrib import admin
from django.contrib.staticfiles.views import serve
from django.urls import path, re_path

from jobup import api, candidates
from jobup.conversations import student_conversations

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/csrf", api.csrf),
    path("api/signup", api.signup),
    path("api/login", api.api_login),
    path("api/logout", api.api_logout),
    path("api/me", api.me),
    path("api/student/<int:id>", api.student),
    path("api/student/conversations", student_conversations),
    path("api/applications", api.applications),
    path("api/applications/draft", api.application_draft),
    path("api/applications/<int:id>", api.application),
    path("api/applications/<int:id>/submit", api.application_submit),
    path("api/applications/<int:id>/documents/<slug:kind>", api.application_document),
    path("api/recruiter/candidates", candidates.candidate_list),
    path("api/recruiter/candidates/<int:id>", candidates.candidate_detail),
    path("api/recruiter/candidates/<int:id>/cv", candidates.candidate_cv),
    re_path(r"^(?!api)[^.]*$", serve, kwargs={"path": "index.html"}),
    path("favicon.ico", serve, kwargs={"path": "favicon.ico"}),
]
