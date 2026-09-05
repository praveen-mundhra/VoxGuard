import urllib.request
print(urllib.request.urlopen('http://localhost:8000/health',timeout=5).read().decode())
