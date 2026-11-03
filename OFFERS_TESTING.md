# Combined offer workflow: JOB-22, JOB-23, JOB-51

Branch: `test/JOB-22-JOB-23-JOB-51`.
This branch merges all three ticket branches and resolves their shared screens,
model fields, API routes, tests, and npm scripts. JOB-22's layout is retained;
JOB-23's server pagination, public reads, edit dialogs and withdrawal are
combined with JOB-51's creation page. Each ticket branch remains separate.

The prepared local checkout is `/private/tmp/jobup-offers-integration`, with its
own database. The running demo is <http://127.0.0.1:8010/recruiter/offers>.

Demo credentials are provided privately in the task conversation.
The account has 14 seeded offers for testing pagination. The browser is already signed in.

1. Open **Créer une offre**, submit an empty form to check validation, then fill
   title, description and sector and publish.
2. Confirm the new detail appears and the offer is first under **Vos offres**.
3. Choose **Modifier**, update title, location or description, and save. Reopen
   the detail and check the changes. Cancel should leave the offer unchanged.
4. Choose **Supprimer**, cancel once, then confirm on a disposable offer. It
   disappears from the recruiter and public `/offers` views. Existing
   applications are retained.
5. Switch between the three pages of seeded offers and open a detail, then
   return to the list. Try an inaccessible or withdrawn offer ID directly.

To restart the prepared checkout:

```bash
cd /private/tmp/jobup-offers-integration
source .venv/bin/activate
make all
python manage.py runserver 127.0.0.1:8010 --noreload
```

For a fresh checkout, install Python and npm dependencies and run `make migrate`.
Create a local recruiter demo account, then seed offers:

```bash
python manage.py shell <<'PY'
from getpass import getpass
from jobup.models import Company, Recruiter, Role, User
company, _ = Company.objects.get_or_create(siret='99999999999991', defaults={'name': 'JobUp Démo Offres'})
user, created = User.objects.get_or_create(email='offers.demo@example.test', defaults={'last_name': 'Démo', 'first_name': 'Recruteur', 'role': Role.RECRUITER})
if created:
    user.set_password(getpass('Choose a local demo password: '))
    user.save()
Recruiter.objects.get_or_create(user=user, defaults={'company': company})
PY
python manage.py seed_recruiter_offers offers.demo@example.test
```

Validation performed: all 47 backend tests, 6 creation tests, 4 edit/delete
interaction tests, 13 existing frontend tests, TypeScript and the production build pass. The full browser
flow was also checked: login, creation, detail, edit/save, confirmation and
withdrawal back to the list.

```bash
python manage.py test
npm run test:create-offer
npm run test:offers
npx tsc --noEmit
make all
```

Public cards now include a description preview, hide empty optional metadata, and link to `/offers/:id`. The public detail shows all supplied offer fields and handles unavailable offers and retryable failures. Verified by four public-offer interaction tests and in Chrome against the demo offer. Run `npm run test:public-offers` for these tests.
