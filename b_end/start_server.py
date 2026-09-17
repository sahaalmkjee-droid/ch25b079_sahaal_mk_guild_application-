import os
import sys

# Ensure current directory is on python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import uvicorn

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8000))
    print(f'[Launcher] Starting SAHAAL FastAPI Server on 0.0.0.0:{port}...')
    uvicorn.run('main:app', host='0.0.0.0', port=port)
