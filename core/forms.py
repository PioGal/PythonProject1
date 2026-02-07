from django import forms
from django.contrib.auth.forms import UserCreationForm
from django.contrib.auth.models import User
from .models import EmployeeProfile
from .models import Shift

class EmployeeRegisterForm(UserCreationForm):
    first_name = forms.CharField(max_length=150, label="Imię")
    last_name = forms.CharField(max_length=150, label="Nazwisko")
    position = forms.CharField(max_length=120, label="Stanowisko")

    class Meta:
        model = User
        fields = ("username", "first_name", "last_name", "position", "password1", "password2")

    def save(self, commit=True):
        user = super().save(commit=False)
        user.first_name = self.cleaned_data["first_name"]
        user.last_name = self.cleaned_data["last_name"]

        if commit:
            user.save()
            EmployeeProfile.objects.create(
                user=user,
                position=self.cleaned_data["position"],
            )
        return user

class ShiftForm(forms.ModelForm):
    class Meta:
        model = Shift
        fields = ["employee", "date", "start_time", "end_time", "note"]