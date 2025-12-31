import sys
import pkgutil

print("Python:", sys.executable)
print("Has pinecone:", pkgutil.find_loader("pinecone") is not None)
