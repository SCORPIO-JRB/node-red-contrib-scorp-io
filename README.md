# node-red-contrib-scorp-io

Node-RED nodes for SCorp-io MQTTS integration.

The package exposes a shared SCorp-io configuration node and a multi-device publishing node for:

- `DBIRTH` messages: device metric declarations;
- `DDATA` messages: device metric values with timestamps.

## Requirements

- Node.js `>=18.0.0`
- Node-RED `>=3.0.0`
- SCorp-io MQTT credentials for production mode

## Installation

### From the Node-RED editor

Open **Menu → Manage palette → Install**, then search for:

```text
node-red-contrib-scorp-io
```

### From npm

Run from the Node-RED user directory, usually `~/.node-red`:

```bash
cd ~/.node-red
npm install node-red-contrib-scorp-io
```

Restart Node-RED after installation.

## Nodes

### `scorp-io-config`

Shared configuration node for the SCorp-io MQTT connection.

| Field | Description |
| --- | --- |
| Mode | `test` disables MQTT publishing; `production` publishes to the broker |
| Client ID | MQTT client identifier |
| Login | MQTT username |
| Password | MQTT password, stored as a Node-RED credential |
| Project ID | SCorp-io project identifier used in MQTT topics |
| Node ID | Edge node identifier used in MQTT topics |

Production broker endpoint:

```text
mqtts://broker-public-prod.scorp-io.com:8883
```

### `scorp-io-device`

Multi-device node that builds and publishes SCorp-io `DBIRTH` and `DDATA` payloads.

#### Input

The node has one input.

| Message | Behavior |
| --- | --- |
| `msg.topic === "birth"` | Emits a `DBIRTH` for all configured devices |
| `msg.deviceId` set | Emits `DDATA` for the matching configured device |
| regular payload | Emits `DDATA` for every device where at least one metric path resolves |

#### Output

The node has one debug output containing the generated message:

| Property | Description |
| --- | --- |
| `msg.topic` | MQTT topic that was/would be published |
| `msg.payload` | Generated SCorp-io payload |
| `msg._scorp.type` | `DBIRTH` or `DDATA` |
| `msg._scorp.device` | Target device id |
| `msg._scorp.simulated` | `true` in test mode |

## Metric configuration

Each device has a list of metrics.

| Metric field | Description | Example |
| --- | --- | --- |
| `name` | Metric name sent to SCorp-io | `pompe-1/etats` |
| `dataType` | Metric type | `Integer`, `Boolean`, `Float` |
| `valuePath` | Path resolved from incoming `msg` for `DDATA` | `msg.payload.pompe1.etats` |

Supported value paths:

```text
msg.payload.pompe1.etats
msg.pompe.etat
pompe1.etats
```

Paths without the `msg.` prefix are resolved from `msg.payload`.

## Topic format

```text
mqtts/{PROJECT_ID}/{MESSAGE_TYPE}/{EDGE_NODE_ID}/{DEVICE_ID}
```

Examples:

```text
mqtts/my-project/DBIRTH/edge-01/pompe-1
mqtts/my-project/DDATA/edge-01/pompe-1
```

## Payload examples

### DBIRTH

```json
{
  "metrics": [
    { "name": "pompe-1/etats", "dataType": "Integer" },
    { "name": "pompe-1/defaut", "dataType": "Boolean" }
  ]
}
```

### DDATA

```json
{
  "metrics": [
    {
      "name": "pompe-1/etats",
      "timestamp": 1710000000000,
      "dataType": "Integer",
      "value": 1
    },
    {
      "name": "pompe-1/defaut",
      "timestamp": 1710000000000,
      "dataType": "Boolean",
      "value": false
    }
  ]
}
```

## Example flow

An importable example is provided in:

```text
examples/scorp-io-basic-flow.json
```

It runs in `test` mode by default, so it does not publish to the production MQTT broker.

## Development

```bash
npm install
npm test
npm run pack:dry-run
```

## License

MIT
