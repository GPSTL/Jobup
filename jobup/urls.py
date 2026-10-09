from django.contrib import admin
from django.contrib.staticfiles.views import serve
from django.urls import path, re_path

urlpatterns = [
    path("admin/", admin.site.urls),
    re_path(r"^[^.]*$", serve, kwargs={"path": "index.html"}),
    path("favicon.ico", serve, kwargs={"path": "favicon.ico"}),
]
