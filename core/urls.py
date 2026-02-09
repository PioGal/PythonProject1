from django.urls import path
from django.contrib.auth import views as auth_views
from . import views


urlpatterns = [
    path("", auth_views.LoginView.as_view(template_name="core/login.html"), name="home"),
    path("rejestracja/", views.register, name="register"),
    path("login/", auth_views.LoginView.as_view(template_name="core/login.html"), name="login"),
    path("logout/", auth_views.LogoutView.as_view(), name="logout"),
    path("pracownik/", views.employee, name="employee"),
    path("grafik/", views.schedule, name="schedule"),
    path("pulpit/", views.dashboard, name="dashboard"),
    path("grafik/edytuj/", views.schedule_editor, name="schedule_editor"),
    path("grafik/zapisz/", views.schedule_apply, name="schedule_apply"),
    path("api/shifts/create/", views.shift_create_api, name="shift_create_api"),
    path("zmiana/dodaj/", views.shift_create, name="shift_create"),
]
