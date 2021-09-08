const mergeAudioStreams = (desktopStream, voiceStream) => {
    const context = new AudioContext();

    // Create a couple of sources
    const source1 = context.createMediaStreamSource(desktopStream);
    const source2 = context.createMediaStreamSource(voiceStream);
    const destination = context.createMediaStreamDestination();

    const desktopGain = context.createGain();
    const voiceGain = context.createGain();

    desktopGain.gain.value = 1;
    voiceGain.gain.value = 1;

    source1.connect(desktopGain).connect(destination);
    // Connect source2
    source2.connect(voiceGain).connect(destination);

    return destination.stream;
};

module.exports = {
    mergeAudioStreams
}