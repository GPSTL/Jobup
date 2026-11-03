from django.contrib import admin
from django.contrib.staticfiles.views import serve
from django.urls import path, re_path

from jobup import api
from jobup.offers import offer_categories, offer_detail, offer_list
from jobup.signup import csrf, signup

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/csrf", csrf),
    path("api/signup", signup),
    path("api/login", api.api_login),
    path("api/logout", api.api_logout),
    path("api/me", api.me),
    path("api/recruiter/offers", offer_list),
    path("api/recruiter/offers/categories", offer_categories),
    path("api/recruiter/offers/<int:id>", offer_detail),
    path("api/student/<int:id>", api.student),
    re_path(r"^(?!api)[^.]*$", serve, kwargs={"path": "index.html"}),
    path("favicon.ico", serve, kwargs={"path": "favicon.ico"}),
]
