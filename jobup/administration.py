"""Administrator account list and student details, separate from Django Admin."""

import os

from django.contrib.auth.views import redirect_to_login
from django.contrib.staticfiles.views import serve
from django.core.paginator import EmptyPage, Paginator
from django.http import FileResponse, HttpResponseForbidden
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .models import Role, Student, User


def admin_page(request):
    if not request.user.is_authenticated:
        return redirect_to_login(request.get_full_path(), login_url="/login")
    if request.user.role != Role.ADMIN:
        return HttpResponseForbidden("Accès réservé aux administrateurs.")
    return serve(request, "index.html", insecure=True)


@api_view(["GET"])
def user_list(request):
    if request.user.role != Role.ADMIN:
        return Response({"error": "Forbidden"}, status=403)
    raw_page = request.query_params.get("page", "1")
    if not raw_page.isascii() or not raw_page.isdecimal() or len(raw_page) > 9:
        return Response({"error": "Invalid page"}, status=400)
    # Student accounts, including inactive accounts. A unique tie-breaker avoids
    # duplicates when several users share the same registration timestamp.
    paginator = Paginator(
        User.objects.filter(role=Role.STUDENT).order_by("-date_joined", "-pk"), 8
    )
    try:
        page = paginator.page(int(raw_page))
    except EmptyPage:
        return Response({"error": "Page not found"}, status=404)
    return Response(
        {
            "count": paginator.count,
            "page": page.number,
            "total_pages": paginator.num_pages,
            "results": [
                {
                    **user.to_dict(),
                    "date_joined": user.date_joined,
                    "is_active": user.is_active,
                    "suspended_at": user.suspended_at if not user.is_active else None,
                    "detail_url": f"/administration/users/{user.pk}",
                }
                for user in page.object_list
            ],
        }
    )


@api_view(["GET"])
def user_detail(request, id: int):
    if request.user.role != Role.ADMIN:
        return Response({"error": "Forbidden"}, status=403)
    user = User.objects.filter(pk=id, role=Role.STUDENT).first()
    if user is None:
        return Response({"error": "Student not found"}, status=404)
    student = Student.objects.select_related("school").filter(user=user).first()
    return Response(
        {
            **user.to_dict(),
            "date_joined": user.date_joined,
            "is_active": user.is_active,
            "suspended_at": user.suspended_at if not user.is_active else None,
            "school": student.school.name if student and student.school else None,
            # No phone field is collected or stored by the current student model.
            "phone": None,
            "applications_sent": student.applications.filter(
                submitted_at__isnull=False
            ).count()
            if student
            else 0,
            "cv_url": f"/api/administration/users/{user.pk}/cv"
            if student and student.resume
            else None,
        }
    )


@api_view(["GET"])
def user_cv(request, id: int):
    if request.user.role != Role.ADMIN:
        return Response({"error": "Forbidden"}, status=403)
    student = Student.objects.filter(user_id=id, user__role=Role.STUDENT).first()
    if student is None or not student.resume:
        return Response({"error": "Resume not found"}, status=404)
    try:
        file = student.resume.open("rb")
    except FileNotFoundError:
        return Response({"error": "Resume not found"}, status=404)
    return FileResponse(
        file, as_attachment=True, filename=os.path.basename(student.resume.name)
    )
