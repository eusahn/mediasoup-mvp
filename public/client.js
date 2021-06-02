const socket = io();
const mediasoup = window.mediasoupClient;
const socketPromise = function(socket) {
  return function request(type, data = {}) {
    return new Promise((resolve) => {
      socket.emit(type, data, resolve);
    });
  }
};
socket.request = socketPromise(socket)

socket.on('connect', async () => {

  const data = await socket.request('getRouterRtpCapabilities');
  const device = new mediasoup.Device();
  await device.load({ routerRtpCapabilities: data })

  const transport = await socket.request('createProducerTransport', {
    forceTcp: false,
    rtpCapabilities: device.rtpCapabilities,
  });
  let producerTransport = device.createSendTransport(transport);

  producerTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
    socket.request('connectProducerTransport', { dtlsParameters, id: producerTransport.id })
      .then(callback)
      .catch(errback);
  });

  producerTransport.on('produce', async ({ kind, rtpParameters }, callback, errback) => {
      const { id } = await socket.request('produce', {
        id: producerTransport.id,
        kind,
        rtpParameters,
      });
      callback({ id });
  });

  producerTransport.on('connectionstatechange', (state) => {
    switch (state) {
      case 'connecting':
        console.log("Producer connecting")
      break;
      case 'connected':
        document.getElementById('local-video').srcObject = stream
        console.log("Producer connected")
      break;
      case 'failed':
        producerTransport.close();
      break;
      default: break;
    }
  });

  const stream = await navigator.mediaDevices.getUserMedia({ video: true });
  const track = stream.getVideoTracks()[0];
  const params = { track };
  const producer = await producerTransport.produce(params)


   /*
  producerTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
    socket.request('connectProducerTransport', { dtlsParameters })
      .then(callback)
      .catch(errback);
  });

  producerTransport.on('produce', async ({ kind, rtpParameters }, callback, errback) => {
    try {
      const { id } = await socket.request('produce', {
        transportId: transport.id,
        kind,
        rtpParameters,
      });
      callback({ id });
    } catch (err) {
      errback(err);
    }
  });

  producerTransport.on('connectionstatechange', (state) => {
    switch (state) {
      case 'connecting':
        console.log("Producer connecting")
      break;
      case 'connected':
        document.getElementById('local-video').srcObject = stream
        console.log("Producer connected")
      break;
      case 'failed':
        transport.close();
      break;
      default: break;
    }
  });

  const stream = await navigator.mediaDevices.getUserMedia({ video: true });
  const track = stream.getVideoTracks()[0];
  const params = { track };
  const producer = await producerTransport.produce(params)



  // Consumer
  const consumerData = await socket.request('createConsumerTransport', {
    forceTcp: false,
  });
  

  const consumerTransport = device.createRecvTransport(consumerData);
  consumerTransport.on('connect', ({ dtlsParameters }, callback, errback) => {
    socket.request('connectConsumerTransport', {
      transportId: transport.id,
      dtlsParameters
    })
      .then(callback)
      .catch(errback);
  });

  consumerTransport.on('connectionstatechange', async (state) => {
    switch (state) {
      case 'connecting':
        console.log("Consumer transport connecting")
        break;

      case 'connected':
        console.log("Consumer transport connected")
        console.log("Consumer Stream", consumerStream)
        if (consumerStream) {
          document.getElementById('remote-video').srcObject = consumerStream

        }
        
        break;

      case 'failed':
        console.log("Consumer transport failed")
        transport.close();
        break;
      default: break;
    }
  });

  console.log("Producer id", producer.id)
  let consumerStream = null;
  socket.on('peer.produce', async () => {
    consumerStream = await consume(consumerTransport, device, producer);
  })

});

async function consume(transport, device, producer) {
  const { rtpCapabilities } = device;
  const data = await socket.request('consume', { rtpCapabilities });
  const {
    producerId,
    id,
    kind,
    rtpParameters,
  } = data;

  if (producer.id === producerId) {
    console.log("The same")
    return null
  }

  let codecOptions = {};
  const consumer = await transport.consume({
    id,
    producerId,
    kind,
    rtpParameters,
    codecOptions,
  });
  const stream = new MediaStream();
  stream.addTrack(consumer.track);
  return stream;
  */
}
)

