"""Django settings for the disposable CI test database."""

from .settings import *  # noqa: F403

# Test fixtures create many accounts. Keep hashing and verification enabled
# without spending production-strength CPU time on disposable test passwords.
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
