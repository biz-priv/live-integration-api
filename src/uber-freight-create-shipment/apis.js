'use strict';
const axios = require('axios');
const _ = require('lodash');

const { AUTH, GET_LOC_URL, CREATE_LOC_URL, SEND_PAYLOAD_URL, UPDATE_PAYLOAD_URL } = process.env;

async function getLocationId({ name, address1, address2, state }) {
  const handleSpecialCharacters = (inputString) => {
    if (/[^a-zA-Z0-9 ]/.test(inputString)) {
      let outputString = inputString.replace(/[^a-zA-Z0-9 ]/g, '*');
      let starPosition = outputString.indexOf('*');
      if (starPosition === 0) {
        outputString = outputString.substring(1);
        starPosition = outputString.indexOf('*');
      }
      if (starPosition !== -1) {
        outputString = outputString.substring(0, starPosition + 1);
      }
      outputString = outputString.replace(' *', '*');
      return outputString;
    }
    return inputString;
  };
  // Apply special character handling to name, address1, and address2
  name = handleSpecialCharacters(name);
  console.info('🚀 ~ file: test.js:1182 ~ getLocationId ~ name:', name);
  address1 = handleSpecialCharacters(address1);
  console.info('🚀 ~ file: test.js:1184 ~ getLocationId ~ address1:', address1);
  address2 = handleSpecialCharacters(address2);
  console.info('🚀 ~ file: test.js:1186 ~ getLocationId ~ address2:', address2);

  const apiUrl = `${GET_LOC_URL}?name=${name}&address1=${address1}&address2=${address2 ?? ''}&state=${state}`;
  console.info('🚀 ~ file: apis.js:40 ~ apiUrl:', apiUrl);
  const headers = {
    Accept: 'application/json',
    Authorization: AUTH,
  };

  try {
    const response = await axios.get(apiUrl, { headers });
    const responseData = _.get(response, 'data', {});
    console.info('🙂 -> responseData:', responseData);

    // Remove asterisks from name, address1, and address2
    name = name.replace('*', '');
    address1 = address1.replace('*', '');
    address2 = address2 ? address2.replace('*', '') : address2;
    // Filter response data to ensure all fields start with name, address1, address2, and equal to state
    const filteredData = _.filter(responseData, (item) => {
      return (
        (_.toUpper(name) === _.toUpper(item.name) ||
          _.startsWith(_.toUpper(item.name), _.toUpper(name))) &&
        (_.toUpper(address1) === _.toUpper(item.address1) ||
          _.startsWith(_.toUpper(item.address1), _.toUpper(address1))) &&
        (_.isEmpty(address2) ||
          _.toUpper(address2) === _.toUpper(item.address2) ||
          _.startsWith(_.toUpper(item.address2), _.toUpper(address2))) &&
        _.toUpper(item.state) === _.toUpper(state)
      );
    });

    if (!_.isEmpty(filteredData)) {
      console.info('🙂 -> filteredData[0]:', filteredData[0]);
      console.info('🙂 -> filteredData[0].id:', filteredData[0].id);
      // Return the location ID or perform additional processing as needed
      return _.get(filteredData, '[0].id', false);
    }
    return false;
  } catch (error) {
    console.error('🙂 -> file: apis.js:34 -> getLocationId -> error:', error);
    return false;
  }
}

async function createLocation({ data, country }) {
  if (country.toLowerCase() === 'usa' && _.get(data, 'zip_code', 0).length > 5) {
    data.zip_code = data.zip_code.slice(0, 5);
  }
  const apiUrl = CREATE_LOC_URL;

  const headers = {
    Accept: 'application/json',
    Authorization: AUTH,
  };

  try {
    const response = await axios.put(apiUrl, data, {
      headers,
    });

    const responseData = _.get(response, 'data', {});
    console.info('🙂 -> file: apis.js:119 -> createLocation -> responseData:', responseData);
    return _.get(responseData, 'id', false);
  } catch (error) {
    const errorMessage = _.get(error, 'response.data', error.message);
    console.error('🙂 -> file: apis.js:58 -> createLocation -> error:', error);
    throw new Error(`Error in Create Location API.
    \n Error Details: ${errorMessage}
    \n Payload:
    \n ${JSON.stringify(data)}`);
  }
}

async function sendPayload({ payload: data }) {
  const apiUrl = SEND_PAYLOAD_URL;

  const headers = {
    Accept: 'application/json',
    Authorization: AUTH,
  };

  try {
    const response = await axios.put(apiUrl, data, {
      headers,
    });

    // Handle the response using lodash or other methods as needed
    const responseData = _.get(response, 'data', {});
    console.info('🙂 -> file: apis.js:74 -> responseData:', responseData);
    // Return the created location data or perform additional processing as needed
    return responseData;
  } catch (error) {
    console.info('🙂 -> file: apis.js:78 -> error:', error);
    const errorMessage = _.get(error, 'response.data', error.message);
    throw new Error(errorMessage);
  }
}

async function updateOrders({ payload: data }) {
  const apiUrl = UPDATE_PAYLOAD_URL;

  const headers = {
    Accept: 'application/json',
    Authorization: AUTH,
  };

  try {
    const response = await axios.put(apiUrl, data, {
      headers,
    });

    // Handle the response using lodash or other methods as needed
    const responseData = _.get(response, 'data', {});
    console.info('🙂 -> file: apis.js:54 -> updateOrders -> responseData:', responseData);
    // Return the created location data or perform additional processing as needed
    return responseData;
  } catch (error) {
    console.info('🙂 -> file: apis.js:103 -> error:', error);
    const errorMessage = _.get(error, 'response.data', error.message);
    throw new Error(`Error in Update Orders API.
    \n Error Details: ${errorMessage}
    \n Payload:
    \n ${JSON.stringify(data)}`);
  }
}

module.exports = { getLocationId, createLocation, sendPayload, updateOrders };
