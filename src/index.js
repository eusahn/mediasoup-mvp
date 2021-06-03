const express = require('express')
const app = express()
const https = require('httpolyglot')
const fs = require('fs')
const mediasoup = require('mediasoup')
const config = require('./config')
const path = require('path')
const Peer = require('./Peer')


// Global variables
let worker;
let mediasoupRouter;


const options = {
    key: fs.readFileSync(path.join(__dirname,config.sslKey), 'utf-8'),
    cert: fs.readFileSync(path.join(__dirname,config.sslCrt), 'utf-8')
}

const httpsServer = https.createServer(options, app)
const io = require('socket.io')(httpsServer, {
  cors: {
    origin: '*',
  }  
})

app.use(express.static(path.join(__dirname, 'public')))

httpsServer.listen(config.listenPort, () => {
    console.log('listening https ' + config.listenPort)
})



async function createWorker() {
  console.log("Create worker called")
  worker = await mediasoup.createWorker({
    logLevel: config.mediasoup.worker.logLevel,
    logTags: config.mediasoup.worker.logTags,
    rtcMinPort: config.mediasoup.worker.rtcMinPort,
    rtcMaxPort: config.mediasoup.worker.rtcMaxPort,
  });
  
  worker.on('died', () => {
    console.error('mediasoup worker died, exiting in 2 seconds... [pid:%d]', worker.pid);
    setTimeout(() => process.exit(1), 2000);
  });
  
  const mediaCodecs = config.mediasoup.router.mediaCodecs;
  mediasoupRouter = await worker.createRouter({ mediaCodecs });
}
createWorker()



let peers = [];

io.on('connection', socket => {
  const peer_id = socket.id
  peers.push(new Peer(peer_id, 'ugly')) 
  const peer = peers.find(p => p.id === peer_id)
  const otherPeers = peers.filter(p => p.id !== peer_id)

  socket.on('peers.existing', (data, callback) => {
    callback(otherPeers)
  })

  socket.on('peer.get.producer_id', (peer_id, callback) => {
    const selectedPeer = peers.find(p => p.id === peer_id)
    if (selectedPeer) {
      callback(selectedPeer.producers.values().next().value.id)
    }
  })

  socket.on('peer.get.producers', (peer_id, callback) => {
    const selectedPeer = peers.find(p => p.id === peer_id)
    if (selectedPeer) {
      const producers = Array.from( selectedPeer.producers.values() );
      callback(producers.map(p => p.id))
    }
  })

  socket.on('disconnect', () => {
    peer.close()
    peers = peers.filter(p => p.id !== peer_id)
    socket.broadcast.emit('peer.destroy', peer_id)
  })

  socket.on('getRouterRtpCapabilities', (data, callback) => {
    callback(mediasoupRouter.rtpCapabilities);
  });

  socket.on('createProducerTransport', async (data, callback) => {
      const { transport, params } = await createWebRtcTransport();
      peer.addTransport(transport)
      callback(params);
  });

  socket.on('connectProducerTransport', async ({ id, dtlsParameters }, callback) => {
    await peer.connectTransport(id, dtlsParameters)
    callback();
  });

  socket.on('produce', async (data, callback) => {
    const {id, kind, rtpParameters} = data;
    const producer = await peer.createProducer(id, rtpParameters, kind)
    callback({ id: producer.id });

    
    // inform clients about new producer
    socket.broadcast.emit('peer.produce', { producer_id: producer.id, peer_id: peer_id});
  });

  socket.on('createConsumerTransport', async (data, callback) => {
    const { transport, params } = await createWebRtcTransport();
    peer.addTransport(transport)
    callback(params);
  });

  socket.on('connectConsumerTransport', async ({ id, dtlsParameters }, callback) => {
    await peer.connectTransport(id, dtlsParameters)
    callback();
  });

  socket.on('consume', async (data, callback) => {
    const { producer_id, consumer_transport_id, rtpCapabilities } = data;
    const consumer = await peer.createConsumer(consumer_transport_id, producer_id,  rtpCapabilities)
    callback(consumer.params);
  });

    /*

  socket.on('connectProducerTransport', async (data, callback) => {
    await producerTransport.connect({ dtlsParameters: data.dtlsParameters });
    callback();
  });

  socket.on('produce', async (data, callback) => {
    const {kind, rtpParameters} = data;
    producer = await producerTransport.produce({ kind, rtpParameters });
    callback({ id: producer.id });

    // inform clients about new producer
    socket.broadcast.emit('peer.produce');
  });


  socket.on('createConsumerTransport', async (data, callback) => {
    try {
      const { transport, params } = await createWebRtcTransport();
      consumerTransport = transport;
      callback(params);
    } catch (err) {
      console.error(err);
      callback({ error: err.message });
    }
  });

  socket.on('connectConsumerTransport', async (data, callback) => {
    await consumerTransport.connect({ dtlsParameters: data.dtlsParameters });
    callback();
  });

  socket.on('consume', async (data, callback) => {
    callback(await createConsumer(producer, data.rtpCapabilities));
  });

})



async function createConsumer(producer, rtpCapabilities) {
  console.log("Create Consumer")
  if (!mediasoupRouter.canConsume(
    {
      producerId: producer.id,
      rtpCapabilities,
    })
  ) {
    console.error('can not consume');
    return;
  }
  try {
    consumer = await consumerTransport.consume({
      producerId: producer.id,
      rtpCapabilities,
      paused: producer.kind === 'video',
    });
  } catch (error) {
    console.error('consume failed', error);
    return;
  }

  if (consumer.type === 'simulcast') {
    await consumer.setPreferredLayers({ spatialLayer: 2, temporalLayer: 2 });
  }

  return {
    producerId: producer.id,
    id: consumer.id,
    kind: consumer.kind,
    rtpParameters: consumer.rtpParameters,
    type: consumer.type,
    producerPaused: consumer.producerPaused
  };
  */
})

async function createWebRtcTransport() {
  const {
    maxIncomingBitrate,
    initialAvailableOutgoingBitrate
  } = config.mediasoup.webRtcTransport;

  const transport = await mediasoupRouter.createWebRtcTransport({
    listenIps: config.mediasoup.webRtcTransport.listenIps,
    enableUdp: true,
    enableTcp: true,
    preferUdp: true,
    initialAvailableOutgoingBitrate,
  });
  if (maxIncomingBitrate) {
    try {
      await transport.setMaxIncomingBitrate(maxIncomingBitrate);
    } catch (error) {
    }
  }
  return {
    transport,
    params: {
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters
    },
  };
}