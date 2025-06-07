import json
import base64
import requests
from datetime import datetime
import subprocess
from cryptography.hazmat.primitives import serialization, hashes
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.backends import default_backend
import winreg
import os
import webbrowser 


def get_machine_guid():
    try:
        with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\Microsoft\Cryptography") as key:
            value, _ = winreg.QueryValueEx(key, "MachineGuid")
            return value
    except Exception as e:
        return str(e)


def encrypt_data(data, public_key_path):
    try:

        current_path = os.getcwd()
        public_key_file = open(current_path+'\\public_key.pem','rb').read()
        public_key_pem=public_key_file
        public_key = serialization.load_pem_public_key(
            public_key_pem, backend=default_backend()
        )
        encrypted_data = public_key.encrypt(
            json.dumps(data).encode('utf-8'),
            padding.OAEP(
                mgf=padding.MGF1(algorithm=hashes.SHA256()),
                algorithm=hashes.SHA256(),
                label=None
            )
        )
        return base64.urlsafe_b64encode(encrypted_data).decode('utf-8')
    except Exception as e:
        return str(e)


def send_data(encrypted_data):
    url = f'http://<backend URL>/message?message={encrypted_data}'
    try:
        response = requests.get(url, verify=False)
        if response.status_code == 200:
            token = str(json.loads(response.content.decode())["randkey"])
            url = "https://<DC API APP URL>/login?token="+token
            webbrowser.open(url)

        else:
            print(f"Request failed with status code: {response.status_code}")
    except Exception as e:
        print(f"Error sending data: {e}")


def main():
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '}

    try:
        response = requests.get("https://<Private IP check API URL>/", headers=headers)
        ipinfo = response.json()
    except Exception as e:
        print(f"Error fetching IP info: {e}")
        return


    try:
        response = requests.get("https://proxycheck.io/v2/"+ipinfo["IP"]+"?vpn=1&asn=1", headers=headers)
        ipinfo2 = response.json()[ipinfo["IP"]]
    except Exception as e:
        print(f"Error fetching IP info: {e}")
        return

    machineguid = get_machine_guid()
    hwid = str(input("Please leave the hidden message here:"))
    hwserial = str(input("Please leave the message here:"))


    data_to_encrypt = {
        "ip": ipinfo.get('IP', 'Unknown'),
        "hwid": hwid,
        "hwserial": hwserial,
        "country":ipinfo2["country"]+"//"+ipinfo2["provider"]+"//"+ipinfo2["organisation"],
        "machineguid": machineguid if machineguid else "Unknown" ,
        "dcid": "sss",
        "regdate": ipinfo.get('CheckTimeUTC', str(datetime.utcnow())),
        "version": 1.01
    }

    encrypted_data = encrypt_data(data_to_encrypt, os.path.join(os.path.dirname(__file__), 'public_key.pem'))

    if encrypted_data:
        send_data(encrypted_data)


if __name__ == "__main__":
    main()
