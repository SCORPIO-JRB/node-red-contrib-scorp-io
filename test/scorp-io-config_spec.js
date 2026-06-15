'use strict';

const helper = require('node-red-node-test-helper');
const configNode = require('../nodes/scorp-io-config.js');

helper.init(require.resolve('node-red'));

// ─────────────────────────────────────────────────────────────────────────────
// Mock du module mqtt pour éviter toute vraie connexion réseau
// ─────────────────────────────────────────────────────────────────────────────
const EventEmitter = require('events');

function makeMqttClient() {
    const client = new EventEmitter();
    client.connected = false;
    client.publish   = (topic, msg, opts, cb) => { if (cb) cb(null); };
    client.end       = (force, opts, cb) => { if (cb) cb(); };
    return client;
}

let mqttClient;
before(function() {
    // Injecter un faux mqtt dans le require cache
    const Module = require('module');
    const orig   = Module._resolveFilename.bind(Module);
    Module._resolveFilename = function(req, ...args) {
        if (req === 'mqtt') return 'mqtt-mock';
        return orig(req, ...args);
    };
    require.cache['mqtt-mock'] = {
        id: 'mqtt-mock', filename: 'mqtt-mock', loaded: true,
        exports: {
            connect: () => {
                mqttClient = makeMqttClient();
                return mqttClient;
            }
        }
    };
});

// ─────────────────────────────────────────────────────────────────────────────

describe('scorp-io-config', function() {

    before(function(done) { helper.startServer(done); });
    after(function(done)  { helper.stopServer(done);  });
    afterEach(function()  { return helper.unload();   });

    // ── Chargement ────────────────────────────────────────────────────────────

    it('doit se charger sans erreur', function(done) {
        const flow = [{
            id: 'cfg1', type: 'scorp-io-config',
            name: 'Test Config',
            clientId: 'client-01', projectId: 'proj-01',
            edgeNodeId: 'edge-01', mode: 'test'
        }];
        helper.load(configNode, flow, function() {
            const cfg = helper.getNode('cfg1');
            cfg.should.have.property('name', 'Test Config');
            done();
        });
    });

    // ── Propriétés ───────────────────────────────────────────────────────────

    it('doit exposer projectId, edgeNodeId, clientId', function(done) {
        const flow = [{
            id: 'cfg1', type: 'scorp-io-config',
            clientId: 'c1', projectId: 'p1', edgeNodeId: 'e1', mode: 'test'
        }];
        helper.load(configNode, flow, function() {
            const cfg = helper.getNode('cfg1');
            cfg.should.have.property('projectId',  'p1');
            cfg.should.have.property('edgeNodeId', 'e1');
            cfg.should.have.property('clientId',   'c1');
            done();
        });
    });

    it('doit avoir mode "test" par défaut', function(done) {
        const flow = [{
            id: 'cfg1', type: 'scorp-io-config',
            clientId: 'c1', projectId: 'p1', edgeNodeId: 'e1'
        }];
        helper.load(configNode, flow, function() {
            const cfg = helper.getNode('cfg1');
            cfg.should.have.property('mode', 'test');
            done();
        });
    });

    // ── API register / deregister ─────────────────────────────────────────────

    it('doit exposer register() et deregister()', function(done) {
        const flow = [{
            id: 'cfg1', type: 'scorp-io-config',
            clientId: 'c1', projectId: 'p1', edgeNodeId: 'e1', mode: 'test'
        }];
        helper.load(configNode, flow, function() {
            const cfg = helper.getNode('cfg1');
            cfg.register.should.be.a.Function();
            cfg.deregister.should.be.a.Function();
            done();
        });
    });

    it('register() doit ajouter le device, deregister() doit le retirer', function(done) {
        const flow = [{
            id: 'cfg1', type: 'scorp-io-config',
            clientId: 'c1', projectId: 'p1', edgeNodeId: 'e1', mode: 'test'
        }];
        helper.load(configNode, flow, function() {
            const cfg    = helper.getNode('cfg1');
            const fakeDevice = { id: 'dev-fake' };
            cfg.register(fakeDevice);
            cfg._devices.should.have.property('dev-fake');
            cfg.deregister(fakeDevice);
            cfg._devices.should.not.have.property('dev-fake');
            done();
        });
    });

    // ── publish() en mode test ────────────────────────────────────────────────

    it('publish() en mode test doit appeler le callback sans erreur', function(done) {
        const flow = [{
            id: 'cfg1', type: 'scorp-io-config',
            clientId: 'c1', projectId: 'p1', edgeNodeId: 'e1', mode: 'test'
        }];
        helper.load(configNode, flow, function() {
            const cfg = helper.getNode('cfg1');
            cfg.publish('topic/test', { metrics: [] }, function(err) {
                (err === null || err === undefined).should.be.true();
                done();
            });
        });
    });

    // ── Mode production : pas de connexion sans vrai broker ───────────────────

    it('ne doit pas connecter le client MQTT en mode test', function(done) {
        const flow = [{
            id: 'cfg1', type: 'scorp-io-config',
            clientId: 'c1', projectId: 'p1', edgeNodeId: 'e1', mode: 'test'
        }];
        helper.load(configNode, flow, function() {
            const cfg = helper.getNode('cfg1');
            // En mode test, node.client ne doit pas exister
            (cfg.client === undefined || cfg.client === null).should.be.true();
            done();
        });
    });
});
