"use strict";

process.title = "Multithread Litecoin Brute Force by Corvus Codex";

const CoinKey = require('coinkey');
const ci = require('coininfo');
const fs = require('fs');
const crypto = require('crypto');
const cluster = require('cluster');
const numCPUs = require('os').cpus().length;
const blessed = require('blessed');

// Initializing a Set to store addresses
let addresses;
addresses = new Set();
// Reading data from a file named 'data.txt'
const data = fs.readFileSync('./data.txt');
// Splitting the data by new line and adding each address to the Set
data.toString().split("\n").forEach(address => {
    if (address.startsWith('L')) {
        addresses.add(address);
    } else {
        console.error('Error: addresses are not in correct format. Legacy Bitcoin Addresses must start with L');
        process.exit(1);
    }
});

let counts = {};
let recentKeys = [];
let startTime = Date.now();
let lastRecentKeysUpdate = Date.now();

function generate() {
    counts[cluster.worker.id] = (counts[cluster.worker.id] || 0) + 1;
    process.send({counts: counts});
    
    let privateKeyHex = crypto.randomBytes(32).toString('hex');
    
    let ck = new CoinKey(Buffer.from(privateKeyHex, 'hex'), ci('LTC').versions);
    
    ck.compressed = false;

    recentKeys.push({address: ck.publicAddress, privateKey: ck.privateWif});
    if (recentKeys.length > 10) {
        recentKeys.shift();
    }
    if (Date.now() - lastRecentKeysUpdate > 60000) {
        process.send({recentKeys: recentKeys});
        lastRecentKeysUpdate = Date.now();
    }

    if(addresses.has(ck.publicAddress)){
        console.log("");
        process.stdout.write('\x07');
        console.log("\x1b[32m%s\x1b[0m", ">> Success: " + ck.publicAddress);
        var successString = "Wallet: " + ck.publicAddress + "\n\nSeed: " + ck.privateWif;
            
        // save the wallet and its private key (seed) to a Success.txt file in the same folder 
        fs.writeFileSync('./Success.txt', successString, (err) => {
            if (err) throw err; 
        })
        process.exit();
    }
}

if (cluster.isMaster) {
    let screen = blessed.screen({
        smartCSR: true
    });

    let boxes = [];

    let infoBox = blessed.box({
        top: '0%',
        left: 0,
        width: '100%',
        height: '30%',
        content: `//Created by: Corvus Codex
//Github: https://github.com/CorvusCodex/
//Licence : MIT License
//Support my work:
//BTC: bc1q7wth254atug2p4v9j3krk9kauc0ehys2u8tgg3
//ETH & BNB: 0x68B6D33Ad1A3e0aFaDA60d6ADf8594601BE492F0
//Buy me a coffee: https://www.buymeacoffee.com/CorvusCodex`,
        border: {
          type: 'line'
        },
        style: {
          fg: 'green',
          border: {
            fg: 'green'
          }
        }
      });

    for (let i = 0; i < numCPUs; i++) {
        let box = blessed.box({
            top: `${30 + i * 50/numCPUs}%`,
            left: '0%',
            width: '100%',
            height: `${100/numCPUs}%`,
            content: `Worker ${i+1} Keys generated: 0 Speed: 0 keys/min`,
            border: {
                type: 'line'
            },
            style: {
                fg: 'green',
                border: {
                    fg: 'green'
                }
            }
        });
        screen.append(infoBox);
        screen.append(box);
        boxes.push(box);
    }

 
        
        
        
            screen.render();
        
            cluster.on('message', (worker, message) => {
                if (message.counts) {
                    for (let workerId in message.counts) {
                        let elapsedTimeInMinutes = (Date.now() - startTime) / 60000;
                        let speedPerMinute = message.counts[workerId] / elapsedTimeInMinutes;
                        boxes[workerId-1].setContent(`Worker ${workerId} Keys generated: ${message.counts[workerId]} Speed: ${speedPerMinute.toFixed(2)} keys/min`);
                    }
                    screen.render();
                }
                
            });
        
            // Fork workers.
            for (let i = 0; i < numCPUs; i++) {
                cluster.fork();
            }
        
            cluster.on('exit', (worker, code, signal) => {
                console.log(`worker ${worker.process.pid} died`);
            });
        } else {
            setInterval(generate, 0);
        }
