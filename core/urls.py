from django.urls import path
from . import views

urlpatterns = [
    path('', views.index, name='index'),
    path('google42a68fc9f9362179.html', views.google_verification, name='google_verification'),
]
