from django.db import models


class User(models.Model):
    name = models.CharField(max_length=32)
    age = models.PositiveSmallIntegerField()
    has_job = models.BooleanField()

    def to_dict(self):
        return {
            "id": self.pk,
            "name": self.name,
            "age": self.age,
            "has_job": self.has_job,
        }


# Utilities #


def createUser(_name: str, _age: int, _has_job: bool) -> User | None:
    _name = _name.strip()
    if 0 < len(_name) <= 32 and 18 <= _age < 200:
        return User.objects.create(name=_name, age=_age, has_job=_has_job)
    return None


def getUser(_id: int) -> User | None:
    try:
        return User.objects.get(id=_id)
    except User.DoesNotExist:
        return None
