from django.shortcuts import render, redirect
from django.contrib.auth import login
from django.contrib.auth.decorators import login_required
from .forms import EmployeeRegisterForm
from datetime import date, timedelta, datetime, time
from .models import Shift
from .models import EmployeeProfile
from .forms import ShiftForm
from django.contrib.auth.decorators import permission_required
from django.http import JsonResponse, HttpResponseBadRequest
from django.views.decorators.http import require_POST
from django.views.decorators.csrf import csrf_exempt
import json
from django.shortcuts import get_object_or_404


def home(request):
    return render(request, "core/home.html")

def register(request):
    if request.method == "POST":
        form = EmployeeRegisterForm(request.POST)
        if form.is_valid():
            user = form.save()
            login(request, user)
            return redirect("employee")
    else:
        form = EmployeeRegisterForm()
    return render(request, "core/register.html", {"form": form})

@login_required
def employee(request):
    return render(request, "core/employee.html")

@login_required
def schedule(request):
    profile, _ = EmployeeProfile.objects.get_or_create(
        user=request.user,
        defaults={"position": "—"}
    )

    today = date.today()
    to_date = today + timedelta(days=14)

    # każdy pracownik widzi tylko swoje zmiany
    shifts = Shift.objects.filter(employee=profile, date__range=(today, to_date))

    return render(
        request,
        "core/schedule.html",
        {"team": profile.team, "shifts": shifts}
    )


@login_required
def dashboard(request):
    return render(request, "core/dashboard.html")

@permission_required("core.add_shift", raise_exception=True)
def shift_create(request):
    manager_profile, _ = EmployeeProfile.objects.get_or_create(
        user=request.user,
        defaults={"position": "—"}
    )
    team = manager_profile.team

    if request.method == "POST":
        form = ShiftForm(request.POST)

        # zawsze ograniczamy listę pracowników
        if team:
            form.fields["employee"].queryset = EmployeeProfile.objects.filter(team=team)
        else:
            form.fields["employee"].queryset = EmployeeProfile.objects.none()

        if form.is_valid():
            shift = form.save(commit=False)

            # dodatkowa kontrola (na wszelki wypadek)
            if not team:
                form.add_error(None, "Nie masz przypisanego zespołu. Skontaktuj się z administratorem.")
            elif shift.employee.team_id != team.id:
                form.add_error("employee", "Możesz ustawiać grafik tylko pracownikom ze swojego zespołu.")
            else:
                shift.save()
                return redirect("schedule")
    else:
        form = ShiftForm()
        if team:
            form.fields["employee"].queryset = EmployeeProfile.objects.filter(team=team)
        else:
            form.fields["employee"].queryset = EmployeeProfile.objects.none()

    return render(request, "core/shift_create.html", {"form": form, "team": team})


@login_required
@permission_required("core.add_shift", raise_exception=True)
def schedule_editor(request):
    profile = get_object_or_404(EmployeeProfile, user=request.user)
    team = profile.team

    if not team:
        return render(request, "core/schedule_editor.html", {"team": None})

    employees = EmployeeProfile.objects.filter(team=team).select_related("user").order_by("user__last_name", "user__first_name")

    # domyślnie: pierwszy pracownik z zespołu
    selected_employee_id = request.GET.get("employee")
    if selected_employee_id:
        selected_employee = get_object_or_404(EmployeeProfile, id=selected_employee_id, team=team)
    else:
        selected_employee = employees.first()

    start = date.today()
    days = [start + timedelta(days=i) for i in range(7)]

    # (na razie nie rysujemy istniejących zmian — dodamy zaraz)
    return render(request, "core/schedule_editor.html", {
        "team": team,
        "employees": employees,
        "selected_employee": selected_employee,
        "days": days,
        "hours": list(range(24)),
    })


@require_POST
@login_required
@permission_required("core.add_shift", raise_exception=True)
def shift_create_api(request):
    # oczekujemy JSON: employee_id, date(YYYY-MM-DD), start_hour, end_hour
    try:
        data = json.loads(request.body.decode("utf-8"))
        employee_id = int(data["employee_id"])
        date_str = data["date"]
        start_hour = int(data["start_hour"])
        end_hour = int(data["end_hour"])
    except Exception:
        return HttpResponseBadRequest("Bad JSON")

    profile = get_object_or_404(EmployeeProfile, user=request.user)
    team = profile.team
    if not team:
        return JsonResponse({"ok": False, "error": "Brak teamu"}, status=400)

    employee = get_object_or_404(EmployeeProfile, id=employee_id, team=team)

    # walidacje
    if not (0 <= start_hour <= 23 and 1 <= end_hour <= 24 and start_hour < end_hour):
        return JsonResponse({"ok": False, "error": "Zły zakres godzin"}, status=400)

    day = datetime.strptime(date_str, "%Y-%m-%d").date()

    shift = Shift.objects.create(
        employee=employee,
        date=day,
        start_time=time(start_hour, 0),
        end_time=time(end_hour, 0),
        note=""
    )

    return JsonResponse({"ok": True, "shift_id": shift.id})