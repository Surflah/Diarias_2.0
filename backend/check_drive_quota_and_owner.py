import os
import json
from pathlib import Path
from google.oauth2 import service_account
from googleapiclient.discovery import build

# Obter o caminho absoluto do diretório atual (backend)
BASE_DIR = Path(__file__).parent

# Verificar se o arquivo de credenciais existe
sa_file = os.environ.get("GOOGLE_SERVICE_ACCOUNT_FILE") or str(BASE_DIR / "credentials_service_account.json")
print(f"Procurando credenciais em: {sa_file}")

# Verificar se o arquivo existe
if not os.path.exists(sa_file):
    print(f"ERRO: Arquivo de credenciais não encontrado em: {sa_file}")
    print("Arquivos no diretório:")
    for file in BASE_DIR.iterdir():
        if file.suffix == '.json':
            print(f"  - {file.name}")
    exit(1)

SCOPES = ["https://www.googleapis.com/auth/drive.metadata.readonly"]

try:
    creds = service_account.Credentials.from_service_account_file(sa_file, scopes=SCOPES)
    svc = build("drive", "v3", credentials=creds, cache_discovery=False)

    # 1) checar quota
    about = svc.about().get(fields="storageQuota").execute()
    print("storageQuota:", json.dumps(about.get("storageQuota", {}), indent=2))

    # 2) checar dono do template
    template_id = "1IE-pqTl_Syu66gMrnbGrIxlGTfW2e1bTgPkpWLWCI_M"  # seu ID
    f = svc.files().get(fileId=template_id, fields="id,name,owners,driveId").execute()
    print("file info:", json.dumps(f, indent=2))

except Exception as e:
    print("Erro:", e)