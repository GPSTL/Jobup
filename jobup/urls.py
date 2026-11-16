from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.contrib.staticfiles.views import serve
from django.urls import path, re_path

from jobup import api, candidates, exclusions, notifications, shortlist
from jobup.companies import cities, companies, company
from jobup.conversations import (
    conversation_messages,
    message_attachment,
    recruiter_conversations,
    student_conversations,
)
from jobup.offers import offer, offers, savedOffers
from jobup.profile import student, student_photo
from jobup.recruiter_company import recruiter_company
from jobup.recruiter_offers import (
    offer_applicants,
    recruiter_application,
    recruiter_offers,
)
from jobup.resume import student_resume
from jobup.administration import (
    admin_login,
    admin_login_page,
    admin_page,
    user_cv,
    user_detail,
    user_filters,
    user_list,
    user_suspension,
)

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/administration/login", admin_login),
    path("api/administration/users", user_list),
    path("api/administration/users/filters", user_filters),
    path("api/administration/users/<int:id>", user_detail),
    path("api/administration/users/<int:id>/cv", user_cv),
    path("api/administration/users/<int:id>/suspension", user_suspension),
    re_path(r"^administration/?$", admin_login_page),
    re_path(r"^administration/.+$", admin_page),
    path("api/csrf", api.csrf),
    path("api/signup", api.signup),
    path("api/login", api.api_login),
    path("api/logout", api.api_logout),
    path("api/me", api.me),
    path("api/offers", offers),
    path("api/offers/<int:id>", offer),
    path("api/student/saved-offers", savedOffers),
    path("api/student/saved-offers/<int:id>", savedOffers),
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
    path("api/recruiter/offers", recruiter_offers),
    path("api/recruiter/offers/<int:id>/applicants", offer_applicants),
    path("api/recruiter/applications/<int:id>", recruiter_application),
    path("api/recruiter/candidates/<int:id>/shortlist", shortlist.shortlist_candidate),
    path("api/recruiter/candidates/<int:id>/exclusion", exclusions.exclude_candidate),
    path("api/recruiter/shortlist", shortlist.shortlist),
    path("api/recruiter/conversations", recruiter_conversations),
    path("api/recruiter/company", recruiter_company),
    path("api/companies", companies),
    path("api/companies/cities", cities),
    path("api/companies/<int:id>", company),
    path("api/notifications", notifications.notification_list),
    path("api/notifications/unread-count", notifications.notification_unread_count),
    path("api/notifications/read-all", notifications.notification_read_all),
    path("api/notifications/preferences", notifications.notification_preferences),
    path("api/notifications/<int:id>/read", notifications.notification_read),
    re_path(r"^(?!api)[^.]*$", serve, kwargs={"path": "index.html"}),
    path("favicon.ico", serve, kwargs={"path": "favicon.ico"}),
]

# Uploaded files (photos), served by Django only in development
urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
