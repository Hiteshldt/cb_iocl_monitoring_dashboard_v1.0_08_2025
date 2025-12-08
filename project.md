CUSTOM SERVER FOR IOCL USING THE AWS IOT ARCHITECTURE THAT WE HAVE ALREADY:

THESE ARE THE AWS ENDPOINTS-> 
INVOKE LINK: https://vtg0j85nv4.execute-api.us-east-1.amazonaws.com/device

1. GET - InvokeLink/device/{deviceId}/graph/hour (CHECKED)		
-> This is to data from the device for last 1 hr (how much ever data is available):
Data style:


2. GET - InvokeLink/device/{deviceId}/graph/day (CHECKED)
{
    "deviceId": "BTTE1250002",
    "period": "day",
    "count": 4,
    "startTime": 1764862907,
    "endTime": 1764949307,
    "data": [
        {
            "d": "BTTE1250002",
            "meter": 2.0,
            "d1": 46.43,
            "d2": 47.6,
            "d3": 46.06,
            "d4": 50.19,
            "offline": 0.0,
            "expireAt": 1765033400.0,
            "date": "2025-12-05,20:33:13",
            "d5": 47.44,
            "d6": 47.11,
            "d7": 50.86,
            "d8": 51.1,
            "d9": 50.29,
            "device_type": 1.0,
            "s1": 77.0,
            "s2": 77.0,
            "s3": 0.0,
            "d11": 43.86,
            "d10": 45.3,
            "sampleCount": 108.0,
            "d13": 45.57,
            "d12": 48.93,
            "i10": 0.0,
            "d15": 45.14,
            "d14": 47.42,
            "d39": 22.0,
            "d17": 49.44,
            "d16": 51.56,
            "d38": 19.0,
            "i1": 1.0,
            "i2": 1.0,
            "d18": 48.17,
            "i3": 1.0,
            "i4": 1.0,
            "i5": 1.0,
            "i6": 1.0,
            "i7": 1.0,
            "i8": 0.0,
            "i9": 0.0,
            "deviceId": "BTTE1250002",
            "imei": 0.0,
            "d40": 23.0,
            "ts": 1764947000.0
        },
        {
            "d": "BTTE1250002",
            "meter": 2.0,
            "d1": 48.19,
            "d2": 47.25,
            "d3": 45.24,
            "d4": 50.34,
            "offline": 0.0,
            "expireAt": 1765033442.0,
            "date": "2025-12-05,20:33:53",
            "d5": 47.51,
            "d6": 47.11,
            "d7": 51.75,
            "d8": 50.95,
            "d9": 49.7,
            "device_type": 1.0,
            "s1": 77.0,
            "s2": 77.0,
            "s3": 0.0,
            "d11": 44.46,
            "d10": 45.16,
            "sampleCount": 108.0,
            "d13": 46.89,
            "d12": 48.83,
            "i10": 0.0,
            "d15": 46.57,
            "d14": 48.72,
            "d39": 22.0,
            "d17": 49.95,
            "d16": 50.95,
            "d38": 19.0,
            "i1": 1.0,
            "i2": 1.0,
            "d18": 47.6,
            "i3": 1.0,
            "i4": 1.0,
            "i5": 1.0,
            "i6": 1.0,
            "i7": 1.0,
            "i8": 0.0,
            "i9": 0.0,
            "deviceId": "BTTE1250002",
            "imei": 0.0,
            "d40": 23.0,
            "ts": 1764947042.0
        },
        {
            "d": "BTTE1250002",
            "meter": 2.0,
            "d1": 52.64,
            "d2": 47.32,
            "d3": 47.6,
            "d4": 54.24,
            "offline": 0.0,
            "expireAt": 1765034522.0,
            "date": "2025-12-05,20:51:53",
            "d5": 43.29,
            "d6": 51.31,
            "d7": 47.94,
            "d8": 53.79,
            "d9": 47.32,
            "device_type": 1.0,
            "s1": 77.0,
            "s2": 77.0,
            "s3": 0.0,
            "d11": 51.51,
            "d10": 48.53,
            "sampleCount": 108.0,
            "d13": 49.34,
            "d12": 49.22,
            "i10": 0.0,
            "d15": 48.67,
            "d14": 51.24,
            "d39": 22.0,
            "d17": 47.52,
            "d16": 48.77,
            "d38": 19.0,
            "i1": 1.0,
            "i2": 1.0,
            "d18": 50.81,
            "i3": 1.0,
            "i4": 1.0,
            "i5": 1.0,
            "i6": 1.0,
            "i7": 1.0,
            "i8": 0.0,
            "i9": 0.0,
            "deviceId": "BTTE1250002",
            "imei": 0.0,
            "d40": 23.0,
            "ts": 1764948122.0
        },
        {
            "d": "BTTE1250002",
            "meter": 2.0,
            "d1": 47.33,
            "d2": 48.69,
            "d3": 48.66,
            "d4": 51.44,
            "offline": 0.0,
            "expireAt": 1765035602.0,
            "date": "2025-12-05,21:09:53",
            "d5": 50.16,
            "d6": 53.18,
            "d7": 53.28,
            "d8": 50.81,
            "d9": 54.21,
            "device_type": 1.0,
            "s1": 77.0,
            "s2": 77.0,
            "s3": 0.0,
            "d11": 50.16,
            "d10": 46.49,
            "sampleCount": 108.0,
            "d13": 48.04,
            "d12": 56.51,
            "i10": 0.0,
            "d15": 44.46,
            "d14": 45.61,
            "d39": 22.0,
            "d17": 47.81,
            "d16": 46.66,
            "d38": 19.0,
            "i1": 1.0,
            "i2": 1.0,
            "d18": 42.69,
            "i3": 1.0,
            "i4": 1.0,
            "i5": 1.0,
            "i6": 1.0,
            "i7": 1.0,
            "i8": 0.0,
            "i9": 0.0,
            "deviceId": "BTTE1250002",
            "imei": 0.0,
            "d40": 23.0,
            "ts": 1764949202.0
        }
    ]
}
Response reference image for example

3. GET - InvokeLink/device/{deviceId}/graph/week (CHECKED)
{
    "deviceId": "BTTE1250002",
    "period": "week",
    "count": 2,
    "startTime": 1764344600,
    "endTime": 1764949400,
    "data": [
        {
            "d": "BTTE1250002",
            "meter": 2.0,
            "d1": 46.43,
            "d2": 47.6,
            "d3": 46.06,
            "d4": 50.19,
            "offline": 0.0,
            "expireAt": 1767539038.0,
            "date": "2025-12-05,20:33:13",
            "d5": 47.44,
            "d6": 47.11,
            "d7": 50.86,
            "d8": 51.1,
            "d9": 50.29,
            "device_type": 1.0,
            "s1": 77.0,
            "s2": 77.0,
            "s3": 0.0,
            "d11": 43.86,
            "d10": 45.3,
            "sampleCount": 108.0,
            "d13": 45.57,
            "d12": 48.93,
            "i10": 0.0,
            "d15": 45.14,
            "d14": 47.42,
            "d39": 22.0,
            "d17": 49.44,
            "d16": 51.56,
            "d38": 19.0,
            "i1": 1.0,
            "i2": 1.0,
            "d18": 48.17,
            "i3": 1.0,
            "i4": 1.0,
            "i5": 1.0,
            "i6": 1.0,
            "i7": 1.0,
            "i8": 0.0,
            "i9": 0.0,
            "deviceId": "BTTE1250002",
            "imei": 0.0,
            "d40": 23.0,
            "ts": 1764947038.0
        },
        {
            "d": "BTTE1250002",
            "meter": 2.0,
            "d1": 49.09,
            "d2": 47.39,
            "d3": 46.3,
            "d4": 51.59,
            "offline": 0.0,
            "expireAt": 1767540237.0,
            "date": "2025-12-05,20:51:53",
            "d5": 46.08,
            "d6": 48.51,
            "d7": 50.18,
            "d8": 51.95,
            "d9": 49.1,
            "device_type": 1.0,
            "s1": 77.0,
            "s2": 77.0,
            "s3": 0.0,
            "d11": 46.61,
            "d10": 46.33,
            "sampleCount": 324.0,
            "d13": 47.27,
            "d12": 48.99,
            "i10": 0.0,
            "d15": 46.79,
            "d14": 49.13,
            "d39": 22.0,
            "d17": 48.97,
            "d16": 50.43,
            "d38": 19.0,
            "i1": 1.0,
            "i2": 1.0,
            "d18": 48.86,
            "i3": 1.0,
            "i4": 1.0,
            "i5": 1.0,
            "i6": 1.0,
            "i7": 1.0,
            "i8": 0.0,
            "i9": 0.0,
            "deviceId": "BTTE1250002",
            "imei": 0.0,
            "d40": 23.0,
            "ts": 1764948237.0
        }
    ]
}
Reference image for week

4. GET - InvokeLink/device/{deviceId}/report?startDate=2025-11-01&endDate=2025-12-01 (CHECKED)

{
    "status": "success",
    "deviceId": "BTTE1250002",
    "startDate": "2025-12-02",
    "endDate": "2025-12-06",
    "recordCount": 817,
    "downloadUrl": "https://devicedatalongterm.s3.amazonaws.com/athena-results/efce8e77-8c76-4192-ae86-deb24f916e0a.csv?AWSAccessKeyId=ASIAX7OSLIERGDSEP6BT&Signature=0KRJX02BiCetZiMBwWZczhYok%2FM%3D&x-amz-security-token=IQoJb3JpZ2luX2VjEJj%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FwEaCXVzLWVhc3QtMSJHMEUCIEXheFDO46vObW%2B2nKFUm0l9HJazzOgLRIRzMRcuXIC2AiEAh%2FDBi%2BWrerFg94nKuTCFmESP0Tnj90joKS71gRhd370q8gIIYRAAGgw1NDg1ODYzNDA2NDIiDHUzXGy4ItafLyuTpSrPAg0M64w9Twf0O475%2FpUPvRHtaYlC0%2Bq%2BbOxNRNRDTCmXt3iDPN23AZCiUdBMbhXf1z1WM0Bqap2eSUNn7YDZ%2FPcSide2GphtMIOiqOQXkZ1g5nrK5nGvHcc9%2Febic1EQPY3VD8T52E%2FyKmxGi%2Fs2zTiC2emM4f0JiVPTszqD2J7kO0BQc%2BhNIWmkkXWbWMM5XPzfDeXrAWa8j07QH5jEL%2FBDIvH7CrnGueReLn3HwIZZWu1idR1uJyS%2B0f9g6RmbohWcEFx1Hgj1oABa9WRD2Qp5Dikiprg%2Fv3z5syXyWnjUTNt1f3fA8M6XeOH08xtgpOadq5A%2B91Mj0mT%2BEr%2BmG1vJX0bvuq8Nx4MFaoOJzZNico8QzVqBlb1jU0pJd%2Bej70RWWhpzCEtyecFarudNhz%2B7eaPcZWpQKVqokkxhn%2Fasmzgm3toZTANXIMinJMK9MPb3y8kGOp4BTQsJlNhPBu8xGNLN5iOUgwfrMVzSDU5iuFJwg8lKha0ILr2PAw%2Bseej6711slLKrjysEgnXOnGxj7ypUsXV0I1a7daszF4FBo7p3yI0bNkQ9Fkw4F30o9St0SESOaLWUZOpQvOIUCJos%2BBuXgY%2Fp1Eo4a8GwDCIqQidMyoBNkfvsMvFk9VCHnvzEtfGgIAsl%2FM1cmhEkGaBZXJu%2BUz4%3D&Expires=1764952585",
    "expiresIn": "1 hour"
}
Here the response is like this, and thats the csv link (here you need to edit the d and deviceid to “IOCL_XTRA_O2_ADMIN”

5. POST - InvokeLink//device/{deviceId}/command (CHECKED)
-> JSON - {"imei":"860710081332028","meter":"2","i1":0} or {"imei":"860710081332028","meter":"2","i1":0, “i2”:1}
 Sending this will update the relay,

6. Webscoket (Live-Data Stream) to connect: (CHECKED) https://ztw46d04q3.execute-api.us-east-1.amazonaws.com/production
to Subscribe we can send: {"action": "subscribe", "deviceId": "BTTE1250001"}

{"type": "deviceData", "deviceId": "BTTE1250002", "data": {"imei": "000000000000000", "d": "BTTE1250002", "meter": 2, "offline": 0, "date": "2025-12-05,21:14:23", "d38": 19, "d39": 22, "d40": 23, "device_type": 1, "s1": 77, "s2": 77, "s3": 0, "d1": 3, "d2": 87, "d3": 81, "d4": 61, "d5": 18, "d6": 73, "d7": 60, "d8": 53, "d9": 24, "d10": 99, "d11": 81, "d12": 79, "d13": 51, "d14": 70, "d15": 90, "d16": 79, "d17": 40, "d18": 46, "i1": 1, "i2": 1, "i3": 1, "i4": 1, "i5": 1, "i6": 1, "i7": 1, "i8": 0, "i9": 0, "i10": 0, "deviceId": "BTTE1250002", "ts": 1764949464, "expireAt": 1764953064}}
Reference data from the websocket

THIS SERVER WILL BE JUST USING THESE ENDPOINTS TO CONNECT TO THE DEVICE ID, AND DO SEVERAL OPERATION OVER IT TO USE IT FOR DIFFERENT PURPOSES, NOW THIS DEVICEID IS WHAT WE ARE USING FOR US, BUT WE SHOULD BE USING SOMETHING ELSE FOR THEM FOR THIS,

HOW IT WILL WORK, THERE WILL BE ADMIN, 
Admin: what admin can do
It will be communicating with “deviceId = BTTE1250001” for everything, but it will show the device id as IOCL_XTRA_O2_ADMIN, and will have a password, note that this will be 8 characters long password and allow jwt, 
After login, it should show the overview, where it will show a very minimal dashboard showing the values of the things, very simple, minimal version 
| Code    | Label                     | Value  |
| ------- | ------------------------- | ------ |
| **d1**  | Inlet-CO₂                 | 1%     |
| **d2**  | Inlet-Dust PM             | 1 Pm   |
| **d3**  | Inlet-Temperature         | 0°C    |
| **d4**  | Inlet-Humidity            | 0%     |
| **d5**  | Inlet-Water PH            | 0%     |
| **d6**  | Inlet-Water Level         | 0      |
| **d7**  | Inlet-Water Temp          | 0      |
| **d8**  | Outlet-CO₂                | 0      |
| **d9**  | Outlet-Dust PM            | 0      |
| **d10** | Outlet-Temperature        | 14     |
| **d11** | Outlet-Humidity           | 763    |
| **d12** | Outlet-Water PH           | 512    |
| **d13** | Outlet-Water Level        | 4095   |
| **d14** | Outlet-Water Temp         | 0      |
| **d15** | SW Ver                    | 22     |
| **d16** | HW Ver                    | 23     |
| **d38** | **GSM Signal (Strength)** | **25** |
| **i1**  | Relay1                    | ON     |
| **i2**  | Relay2                    | ON     |
| **i3**  | Relay3                    | ON     |
| **i4**  | Relay4                    | ON     |
| **i5**  | Relay5                    | ON     |
| **i6**  | Relay6                    | ON     |
| **i7**  | Relay7                    | ON     |
| **i8**  | Relay8                    | ON     |
Please check what these values are, so make the thigsn acorignly.

C. then there will be an impact tab, that will - the inlet and outlet to for each value and show what impact for each has been made, and then will come the automation tab, that tab will show the relay automation option, when its off, the user should be able to update each relay value, note that, once a relay is tapped, then, it should wait to confirm tis change from the next latest data, till then block the tab, (for upaitn relay use the given command method to update the relay).
D. Note, in relay automation mode, there should be main three option, manual, sensor based automation and then time based automation, so i should be able to set each rely like that, if they are set to manual mode, then manually should be able to update, and if its sensor based auotamtion, then i should be abel to set high and low value for sensor value, so that if the value for that one sensors is below that then on or off, or vice versa, make it such that i should be able to edit and do changes, for time based automation, i should be able to set day based autoatmion, for exmaple from thsi time to this everyday to be on or off, and smae on the other side, 

All this will be happening based on the relay control command function, and the state everything will be saved in a database to preseevr the state, and since this server will be used by one few people, and only one user is there, so no need to attach a database, you can preserver these values in the server file itself, as this will only monitor one value, and then there will be analytic, that will show the data in week and months, option to show the graph for each value in week and month, and then there will be the download option to download, now you have the api tools that is needed, so make the things accoringy

WHAT I WANT IS A EXPRESS SERVER, AND A REACT FRONTEND, DATABASE NO NEEDED, AS THIS IS A ONE DEVICE ONLY, SO YOU CAN STORE THE VALUES INSIDE THE SERVER ONLY, OTHER MANY THINGS CAN CACHE AND MAKE BETTER USE OF API AND HANDLING, AND THER SHOULD BE APIS FOR COMMUNCIATION BETWEEN THE SERVER AND THE FRONTEND, THE BACKEND WILL COMMUICATE WITH THE FRONTEND AND SHOW EVERYTHING ACCOINLY, 

NOTE: THIS UNIT IS CONNECTED TO A DISPALY THAT WILL BE SHOWING THE DATA, NOW THIS IS HOW THE DATA IS BEEN SHOWN, 

The data is been through a display via the command, so for example, I get the data from the device, and then, this data needs to be sent to the controller once again to show that on a display, that is 
“AQI: 51     TEMP: 32     HUMIDITY:67%    12:45   27/11/2025”

Now these values needs to be send to the console using the command, then only it will be shown, now these values needs to be 
For example, it needs to go like this

  "i11": 51,
  "i12": 32,
  "i13": 67,
  "i14": 12,
  "i15": 45,
  "i16": 27,
  "i17": 11,
  "i18": 25
what this server will do is, it will calculate the aqi based on outlet data, it will calculator the aqi, then temp, humidity, data and time it will format in the order, and push that to the board in 10 sec time interval, that how the display will be updated


{"imei":"000000000000000","d":"BTTE1250002","meter":2,"offline":0,"date":"2025-12-06,17:48:08","d38":19,"d39":22,"d40":23,"device_type":1,"s1":77,"s2":77,"s3":0,"d1":41,"d2":46,"d3":96,"d4":81,"d5":28,"d6":62,"d7":24,"d8":90,"d9":43,"d10":26,"d11":95,"d12":11,"d13":25,"d14":75,"d15":70,"d16":32,"d17":92,"d18":90,"i1":1,"i2":1,"i3":0,"i4":0,"i5":0,"i6":0,"i7":0,"i8":0,"i9":0,"i10":0}
