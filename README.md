# node-red-contrib-scorp-io

Palette Node-RED pour l'intégration d'équipements industriels avec la plateforme **SCorp-io** via MQTT sécurisé (MQTTS).

## Installation

### Via Node-RED (recommandé)
Dans Node-RED > Menu > Manage palette > Install :
```
node-red-contrib-scorp-io
```

### Via npm
```bash
cd ~/.node-red
npm install node-red-contrib-scorp-io
```

---

## Nœuds disponibles

### `scorp-io-config` — Configuration
Nœud de configuration partagé. Définit la connexion au broker SCorp-io.

| Champ | Description |
|-------|-------------|
| Client ID | Identifiant unique de connexion MQTT |
| Login | Nom d'utilisateur MQTT |
| Password | Mot de passe MQTT |
| Project ID | Identifiant du projet SCorp-io |
| Edge Node ID | Identifiant du nœud edge |

**Connexion automatique** au démarrage sur :
- Host : `broker-public-prod.scorp-io.com`
- Port : `8883`
- TLS : activé (certificat serveur uniquement)

---

### `scorp-io-device` — Device
Représente un équipement physique. Publie les messages **DBIRTH** et **DDATA**.

#### Entrées
| Entrée | Rôle |
|--------|------|
| **1 — data** | Reçoit `msg.payload` et publie un DDATA avec les valeurs résolues |
| **2 — birth** | Force la (ré)émission d'un DBIRTH |

#### Configuration des métriques
Chaque métrique comporte :
- **name** : nom fixe ou chemin dans `msg.payload` (ex: `pompe1.etats`)
- **dataType** : `Int8`, `Int16`, `Int32`, `Int64`, `UInt8`, `UInt16`, `UInt32`, `UInt64`, `Float`, `Double`, `Boolean`, `String`, `DateTime`
- **value** : chemin dans `msg.payload` (ex: `pompe1.etats`)

---

## Format des messages

### DBIRTH
```
Topic   : mqtts/{PROJECT_ID}/DBIRTH/{EDGE_NODE_ID}/{DEVICE_ID}
Payload : {
  "metrics": [
    { "name": "pompe-1/etats",  "dataType": "Integer" },
    { "name": "pompe-1/defaut", "dataType": "Boolean" }
  ]
}
```

### DDATA
```
Topic   : mqtts/{PROJECT_ID}/DDATA/{EDGE_NODE_ID}/{DEVICE_ID}
Payload : {
  "metrics": [
    { "name": "pompe-1/etats",  "dataType": "Integer", "value": 1     },
    { "name": "pompe-1/defaut", "dataType": "Boolean", "value": false }
  ]
}
```

---

## Exemple de msg.payload entrant

```json
{
  "pompe1": {
    "etats": 1,
    "defaut": false,
    "status": 3.14
  }
}
```

---

## Références
- [Documentation SCorp-io MQTTS](https://scorp-io.gitbook.io/guide-to-scorp-io/broker-public/configuration-mqtts)
- [Node-RED](https://nodered.org)
