'use strict';

const { get, filter, toUpper, set } = require('lodash');
const livePayloadOriginal = require('./livePayload.json');
const { getLocationId, createLocation, sendPayload, updateOrders } = require('./apis');
const {
  getFormattedTimestamp,
  getExpirationTimestamp,
  statuses,
  equipmentTypeMapping,
} = require('./helper');
const { dynamoInsert } = require('../shared/dynamo');

const { LOG_TABLE } = process.env;

const logData = {
  FreightId: '',
  Timestamp: getFormattedTimestamp(new Date()),
  Expiration: getExpirationTimestamp(7),
  UberFreightPayload: '',
  LiVePayload: '',
  LiVeResponse: '',
  Status: '',
  Message: '',
};

module.exports.handler = async (event) => {
  try {
    let uberPayload = get(event, 'body', {});
    uberPayload = JSON.parse(uberPayload);
    console.info('🙂 -> file: index.js:23 -> module.exports.handler= -> uberPayload:', uberPayload);
    const uberEqType = toUpper(get(uberPayload, 'modeExecution.equipmentName', ''));
    console.info('🙂 -> file: index.js:24 -> module.exports.handler= -> uberEqType:', uberEqType);
    const mcEqType = get(equipmentTypeMapping, uberEqType, 'O');
    console.info('🙂 -> file: index.js:26 -> module.exports.handler= -> mcEqType:', mcEqType);
    const id = get(uberPayload, 'modeExecution.id');
    console.info('🙂 -> file: index.js:95 -> module.exports.handler= -> id:', id);
    logData.FreightId = String(id);
    logData.UberFreightPayload = uberPayload;
    const livePayload = { ...livePayloadOriginal };
    livePayload.bill_distance_um = get(uberPayload, 'modeExecution.totalDistanceUOM');
    livePayload.commodity_id = get(uberPayload, 'modeExecution.freights[0].commodityCode');
    livePayload.blnum = id;
    livePayload.equipment_type_id = mcEqType;
    if (
      filter(
        get(uberPayload, 'modeExecution.freights[0].lineItems'),
        (data) => get(data, 'hazmat') === true
      ).length >= 0
    ) {
      livePayload.hazmat = true;
    }
    livePayload.high_value =
      parseInt(get(uberPayload, 'modeExecution.freightValue', 0), 10) > 100000;
    livePayload.order_value = parseInt(get(uberPayload, 'modeExecution.freightValue', 0), 10);
    livePayload.pieces = parseInt(get(uberPayload, 'modeExecution.handlingUnit', 0), 10);
    livePayload.weight = get(uberPayload, 'modeExecution.weight');
    livePayload.weight_um = get(uberPayload, 'modeExecution.weightUOM');

    const billToName = get(uberPayload, 'tenderInformation.billToName', '')
      .replace(/[^a-zA-Z0-9]/g, '')
      .toUpperCase();
    console.info(
      '🙂 -> file: index.js:59 -> module.exports.handler= -> billToName:',
      billToName,
      'RR Donnelly'.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
    );
    let billToCustomer = '';
    if (billToName.includes('RR Donnelley'.replace(/[^a-zA-Z0-9]/g, '').toUpperCase())) {
      billToCustomer = 'RRDOCHIL';
    } else if (billToName.includes('U-Haul'.replace(/[^a-zA-Z0-9]/g, '').toUpperCase())) {
      billToCustomer = 'UHAU85AZ';
    } else {
      billToCustomer = 'placeholder';
    }
    console.info(
      '🙂 -> file: index.js:66 -> module.exports.handler= -> billToCustomer:',
      billToCustomer
    );

    const rates = get(uberPayload, 'financialParties[0].financialCharges', []).map(
      (financialCharge) => ({
        chargeCode: get(financialCharge, 'name'), // actual mapping will be provided by Thomas
        rate: get(financialCharge, 'rate') * get(financialCharge, 'ratedQuantity'),
      })
    );
    console.info('🙂 -> file: index.js:71 -> module.exports.handler= -> rates:', rates);
    const supportInfos = get(uberPayload, 'modeExecution.supportInfos', [])
      .filter((supportInfo) => get(supportInfo, 'value') === 'Y')
      .map((supportInfo) => get(supportInfo, 'name'))
      .join(', ');
    console.info(
      '🙂 -> file: index.js:93 -> module.exports.handler= -> supportInfos:',
      supportInfos
    );

    livePayload.stops = await Promise.all(
      get(uberPayload, 'modeExecution.stops', []).map(async (stop) => {
        const name = get(stop, 'location.name');
        const address1 = get(stop, 'location.address.address1');
        const cityName = get(stop, 'location.address.city');
        const state = get(stop, 'location.address.state');
        const zipCode = get(stop, 'location.address.zip');
        const country = get(stop, 'location.address.country');
        return {
          __type: 'stop',
          __name: 'stops',
          company_id: 'TMS',
          appt_required: false,
          confirmed: false,
          driver_load_unload: get(stop, 'driverTouch') ? 'Y' : 'N',
          late_eta_colorcode: false,
          order_sequence: get(stop, 'sequenceNumber'),
          stop_type: get(stop, 'type') === 'PICKUP' ? 'PU' : 'SO',
          sched_arrive_early: getFormattedTimestamp(get(stop, 'apptEarliestDatetimeUTC', '')),
          sched_arrive_late: getFormattedTimestamp(get(stop, 'apptLatestDatetimeUTC', '')),
          status: 'A',
          requested_service: false,
          prior_uncleared_stops: false,
          location_id: await getLocationIdFromLive({
            name,
            address1,
            cityName,
            state,
            zipCode,
            country,
          }),
          referenceNumbers: get(stop, 'contacts', []).map((contact) => ({
            __type: 'reference_number',
            __name: 'referenceNumbers',
            company_id: 'TMS',
            element_id: '128',
            partner_id: 'TMS',
            reference_number: get(contact, 'phoneNumber'),
            reference_qual: get(contact, 'type'),
            send_to_driver: true,
            version: '004010',
          })),
          stopNotes: get(stop, 'comments', []).map((comment) => ({
            __name: 'stopNotes',
            __type: 'stop_note',
            company_id: 'TMS',
            comment_type: 'DC',
            comments: get(comment, 'value'),
          })),
        };
      })
    );

    livePayload.stops = livePayload.stops.sort(
      (a, b) => Number(get(a, 'order_sequence', 0)) - Number(get(b, 'order_sequence', 0))
    );
    console.info(
      '🙂 -> file: index.js:50 -> module.exports.handler= -> livePayload:',
      JSON.stringify(livePayload)
    );

    logData.LiVePayload = livePayload;
    console.info(
      '🙂 -> file: index.js:153 -> module.exports.handler= -> livePayload:',
      livePayload
    );

    const createShipmentRes = await sendCreateShipmentPayload({ payload: livePayload });

    logData.Status = statuses.SUCCESS;
    logData.Message = 'Shipment created succsfully.';

    const movements = get(createShipmentRes, 'movements', []);
    // Add "brokerage_status" to each movement
    const updatedMovements = movements.map((movement) => ({
      ...movement,
      brokerage_status: 'NEWAPI',
    }));
    // Update the movements array in the response
    set(createShipmentRes, 'movements', updatedMovements);

    const updateResponse = await updateOrders({ payload: createShipmentRes });
    logData.LiVeResponse = updateResponse;

    await dynamoInsert(LOG_TABLE, logData);

    return {
      statusCode: 200,
      body: JSON.stringify(
        {
          response: createShipmentRes,
        },
        null,
        2
      ),
    };
  } catch (err) {
    console.info('🙂 -> file: index.js:16 -> module.exports.handler= -> err:', err);
    logData.Status = statuses.ERROR;
    logData.Message = get(err, 'message');
    await dynamoInsert(LOG_TABLE, logData);
    return {
      statusCode: 400,
      body: JSON.stringify(
        {
          message: get(err, 'message'),
        },
        null,
        2
      ),
    };
  }
};

async function getLocationIdFromLive({
  name,
  address1,
  address2 = '',
  cityName,
  state,
  zipCode,
  country,
}) {
  try {
    let locationId = '';
    locationId = await getLocationId({ name, address1, address2, state });
    console.info('🙂 -> file: index.js:89 -> getLocationIdFromLive -> locationId:', locationId);
    if (!locationId) {
      const data = {
        __type: 'location',
        company_id: 'TMS',
        address1,
        address2,
        city_name: cityName,
        is_active: true,
        name,
        state,
        zip_code: zipCode,
      };
      locationId = await createLocation({ data, country });
    }
    if (!locationId) {
      throw new Error('Error in creating location');
    }
    console.info('🙂 -> file: index.js:107 -> getLocationIdFromLive -> locationId:', locationId);
    return locationId;
  } catch (err) {
    console.info('🙂 -> file: index.js:111 -> getLocationIdFromLive -> err:', err);
    throw err;
  }
}

async function sendCreateShipmentPayload({ payload }) {
  try {
    return await sendPayload({ payload });
  } catch (err) {
    console.info('🙂 -> file: index.js:120 -> sendCreateShipmentPayload -> err:', err);
    throw err;
  }
}
