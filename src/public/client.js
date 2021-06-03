const socket = io();
const videos = {}
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
    console.log("Produce")
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
  const videoProducer = await producerTransport.produce(params)

  const audioStream = await navigator.mediaDevices.getUserMedia({ audio: {
    echoCancellation: true
  } });
  const audioTrack = audioStream.getAudioTracks()[0];
  const audioParams = { track: audioTrack };
  const audioProducer = await producerTransport.produce(audioParams)
  


  const consumerData = await socket.request('createConsumerTransport', {
    forceTcp: false,
  });
  const consumerTransport = device.createRecvTransport(consumerData);

  consumerTransport.on('connect', ({ dtlsParameters }, callback, errback) => {
    socket.request('connectConsumerTransport', {
      id: consumerTransport.id,
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
        break;

      case 'failed':
        console.log("Consumer transport failed")
        transport.close();
        break;
      default: break;
    }
  });

  //const consumerStream = await consume(consumerTransport, device, producer);
  let consumerStream = null;
  socket.on('peer.produce', async ({ producer_id, peer_id }) => {

    const consumerStream = await consume(consumerTransport, device, producer_id);
    if (!videos[peer_id]) {
      const video = document.createElement('video')
      //video.muted = true;
      video.setAttribute('playsinline', true)
      video.setAttribute('autoplay', true)
      video.srcObject = consumerStream;
      videos[peer_id] = video
      document.querySelector(".video-container").appendChild(video)
    } else {
      const videoTrack = videos[peer_id].srcObject
      consumerStream.getTracks().forEach(track => videoTrack.addTrack(track));
    }
  })

  socket.on('peer.destroy', (peer_id) => {
    videos[peer_id] && videos[peer_id].remove()
    delete videos[peer_id]
  })

  const existingPeers = await socket.request('peers.existing')
  for (var i = 0; i < existingPeers.length; i++) {
    const peer_id = existingPeers[i].id
    const producer_ids = await socket.request('peer.get.producers', peer_id)
    for (var k = 0; k < producer_ids.length; k++) {
      const consumerStream = await consume(consumerTransport, device, producer_ids[k]);
      if (!videos[peer_id]) {
        const video = document.createElement('video')
        //video.muted = true;
        video.setAttribute('playsinline', true)
        video.setAttribute('autoplay', true)
        video.srcObject = consumerStream;
        videos[peer_id] = video
        document.querySelector(".video-container").appendChild(video)
      } else {
        const videoTrack = videos[peer_id].srcObject
        consumerStream.getTracks().forEach(track => videoTrack.addTrack(track));
      }
    }
    /*
    const consumerStream = await consume(consumerTransport, device, producer_id);
    const video = document.createElement('video')
    video.muted = true;
    video.setAttribute('playsinline', true)
    video.setAttribute('autoplay', true)
    video.srcObject = consumerStream;
    videos[existingPeers[i].id] = video
    document.querySelector(".video-container").appendChild(video)
    */
    
  }


}
)

async function consume(transport, device, producer_id) {
  const { rtpCapabilities } = device;
  const data = await socket.request('consume', { producer_id, consumer_transport_id: transport.id, rtpCapabilities });
  const {
    producerId,
    id,
    kind,
    rtpParameters,
  } = data;


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
}



