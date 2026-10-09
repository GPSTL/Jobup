from django.http import HttpRequest, JsonResponse
from rest_framework.decorators import api_view

from .models import getUser


@api_view(["GET"])
def user(_: HttpRequest, id: int):
    usr = getUser(id)
    if usr == None:
        return JsonResponse({"error": "User not found"}, status=404)
    return JsonResponse(usr.to_dict())
