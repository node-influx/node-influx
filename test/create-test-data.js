const path = require('path')
const file = require('fs').createWriteStream(path.join(__dirname, 'fixtures_test_data.txt'))
const now = Date.now()

for (let k = 0; k < 3; k++) {
  for (let i = 0; i < 10; i++) {
    for (let offset = 0; Math.random() > 0.2; offset++) {
      file.write(`series_${k},my_tag=${i} my_value=${Math.round(Math.random() * 100)} ${now - offset}000000\n`)
    }
  }
}

file.end()
