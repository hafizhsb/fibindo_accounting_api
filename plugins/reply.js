const successRes = (data, totalCount) => {
  return {
    status: 'ok',
    statusCode: 200,
    data,
    totalCount
  }
}

const errorRes = (message) => {
  return {
    status: 'error',
    statusCode: 500,
    message
  }
}

module.exports = {
  successRes,
  errorRes
}
