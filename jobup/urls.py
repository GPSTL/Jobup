from django.contrib import admin
from django.contrib.staticfiles.views import serve
from django.urls import path, re_path

from jobup import api
from jobup.offers import offer_detail, offer_list, offer_categories, public_offer_detail, public_offer_list

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/csrf", api.csrf),
    path("api/signup", api.signup),
    path("api/login", api.api_login),
    path("api/logout", api.api_logout),
    path("api/me", api.me),
    path("api/recruiter/offers", offer_list),
    path("api/recruiter/offers/categories", offer_categories),
    path("api/recruiter/offers/<int:id>", offer_detail),
    path("api/offers", public_offer_list),
    path("api/offers/<int:id>", public_offer_detail),
    path("api/student/<int:id>", api.student),
    re_path(r"^(?!api)[^.]*$", serve, kwargs={"path": "index.html"}),
    path("favicon.ico", serve, kwargs={"path": "favicon.ico"}),
]
