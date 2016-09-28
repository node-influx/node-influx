for (let k = 0; k < 3; k++) {
  for (let i = 0; i < 10; i++) {
    while (Math.random() > 0.2) {
      console.log(`series_${k},my_tag=${i} my_value=${Math.round(Math.random() * 100)}`)
    }
  }
}
