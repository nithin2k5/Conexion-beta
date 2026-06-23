const tf = require('@tensorflow/tfjs');
const nsfwjs = require('nsfwjs');
const fs = require('fs');

async function run() {
  console.log("Loading NSFW model...");
  try {
    const model = await nsfwjs.load();
    console.log("Model loaded successfully!");
    
    // Create a dummy image tensor to pass into the model to verify prediction works
    // Shape [1, 224, 224, 3] is the standard input for MobileNet
    const dummyTensor = tf.zeros([224, 224, 3], 'int32');
    
    console.log("Running inference on dummy image...");
    const predictions = await model.classify(dummyTensor);
    
    console.log("Inference successful! Predictions for a blank image:");
    console.log(predictions);
  } catch (err) {
    console.error("Error during test:", err);
  }
}

run();
