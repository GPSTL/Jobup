from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.contrib.staticfiles.views import serve
from django.urls import path, re_path

from jobup import api

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/csrf", api.csrf),
    path("api/signup", api.signup),
    path("api/login", api.api_login),
    path("api/logout", api.api_logout),
    path("api/me", api.me),
    path("api/student/<int:id>", api.student),
    path("api/student/<int:id>/photo", api.student_photo),
    re_path(r"^(?!api)[^.]*$", serve, kwargs={"path": "index.html"}),
    path("favicon.ico", serve, kwargs={"path": "favicon.ico"}),
]

# Uploaded files (photos), served by Django only in development
urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
