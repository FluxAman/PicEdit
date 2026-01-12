from django.shortcuts import render

def index(request):
    return render(request, 'core/index.html')

def google_verification(request):
    return render(request, 'google42a68fc9f9362179.html', content_type='text/html')
