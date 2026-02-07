from django.contrib import admin
from .models import Team, EmployeeProfile, Shift

@admin.register(Team)
class TeamAdmin(admin.ModelAdmin):
    list_display = ("name",)

@admin.register(EmployeeProfile)
class EmployeeProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "position", "team")
    list_filter = ("team",)

@admin.register(Shift)
class ShiftAdmin(admin.ModelAdmin):
    list_display = ("employee", "team_name", "date", "start_time", "end_time")
    list_filter = ("employee__team", "date")
    search_fields = ("employee__user__first_name", "employee__user__last_name")

    def team_name(self, obj):
        return obj.employee.team

    team_name.short_description = "Zespół"
