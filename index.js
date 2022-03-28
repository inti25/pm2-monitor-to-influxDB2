require('dotenv').config()
const pm2 = require('pm2');
const schedule = require('node-schedule');
const os = require('os');
const {InfluxDB} = require('@influxdata/influxdb-client');
const {Point} = require('@influxdata/influxdb-client');

// You can generate an API token from the "API Tokens Tab" in the UI
const token = process.env.INFLUX_DB_TOKEN;
const org = process.env.INFLUX_DB_ORG;
const bucket = process.env.INFLUX_DB_BUCKET;
const client = new InfluxDB({url: process.env.INFLUX_DB_URL, token: token});
const writeApi = client.getWriteApi(org, bucket);
writeApi.useDefaultTags({host: os.hostname()})

let pm2Connected = false;

pm2.connect(function(err) {
    if(err) {
        console.log('conenct pm2 failed! ', err);
    } else {
        pm2Connected = true;
    }
})

const cornJob = schedule.scheduleJob('*/10 * * * * *', async function() { // every 10s
    if(pm2Connected)
        pm2.list(pm2ListCallback);
});

function pm2ListCallback(err, resp){
    if (err) {
      console.error("PM2 List Error" + err);
    } else {
        let pointArray = [];
        for (let index = 0; index < resp.length; index++) {
            const element = resp[index];
            const cpu_process_usage = element.monit.cpu;
            const physical = element.monit.memory;
            const status = element.pm2_env.status;
            pointArray.push(
                new Point(`${element.name}-${element.pm_id}`)
                    .floatField('used_percent', cpu_process_usage)
                    .floatField('memory_used', physical)
                    .stringField('status', status)
            )
        }
        writeApi.writePoints(pointArray);
    }
  }