from django.contrib import admin
from django.contrib.staticfiles.views import serve
from django.urls import path, re_path

from jobup import api

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/user/<int:id>", api.user),
    path("favicon.ico", serve, kwargs={"path": "favicon.ico"}),
    re_path(r"^.*$", serve, kwargs={"path": "index.html"}),
]
