'use strict';

const { get, filter, toUpper, set } = require('lodash');
const livePayloadOriginal = require('./livePayload.json');
const { getLocationId, createLocation, sendPayload, updateOrders } = require('./apis');
const {
  getFormattedTimestamp,
  getExpirationTimestamp,
  statuses,
  equipmentTypeMapping,
  referenceNumberMapping,
  chargeCodeMapping,
  getCustomerCode,
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

    const billToCustomer = getCustomerCode(get(uberPayload, 'tenderInformation.billToName', ''));

    console.info(
      '🙂 -> file: index.js:66 -> module.exports.handler= -> billToCustomer:',
      billToCustomer
    );

    livePayload.customer_id = billToCustomer;

    const rates = get(uberPayload, 'financialParties[0].financialCharges', []).map(
      (financialCharge) => ({
        chargeCode: get(
          chargeCodeMapping,
          get(financialCharge, 'chargeTypeId'),
          get(financialCharge, 'chargeTypeId')
        ),
        rate: get(financialCharge, 'rate') * get(financialCharge, 'ratedQuantity'),
      })
    );
    console.info('🙂 -> file: index.js:71 -> module.exports.handler= -> rates:', rates);

    const freightCharge = rates.filter((rate) => get(rate, 'chargeCode') === 'Freight_Charge')[0];
    const otherCharges = rates
      .filter((rate) => get(rate, 'chargeCode') !== 'Freight_Charge')
      .map((charge, index) => ({
        __type: 'other_charge',
        __name: 'otherCharges',
        company_id: 'TMS',
        amount: get(charge, 'rate'),
        amount_c: 'USD',
        amount_n: get(charge, 'rate'),
        amount_r: 1.0,
        calc_method: 'F',
        charge_id: get(charge, 'chargeCode'),
        rate: get(charge, 'rate'),
        sequence: index + 1,
        units: 1.0,
      }));

    livePayload.freight_charge = get(freightCharge, 'rate');
    livePayload.freight_charge_c = 'USD';
    livePayload.freight_charge_n = get(freightCharge, 'rate');
    livePayload.freight_charge_r = 1.0;
    livePayload.otherCharges = otherCharges;

    const supportInfos = get(uberPayload, 'modeExecution.supportInfos', [])
      .filter((supportInfo) => get(supportInfo, 'value') === 'Y')
      .map((supportInfo) => get(supportInfo, 'name'));
    console.info(
      '🙂 -> file: index.js:93 -> module.exports.handler= -> supportInfos:',
      supportInfos
    );

    if (supportInfos.includes('LIFTGATE')) {
      livePayload.planningComment = 'LG';
    } else if (supportInfos.includes('INSIDE_DELIVERY')) {
      livePayload.planningComment = 'DL';
    }

    const references = get(uberPayload, 'modeExecution.freights[0].references', []);
    console.info('🙂 -> file: index.js:104 -> module.exports.handler= -> references:', references);

    livePayload.stops = await Promise.all(
      get(uberPayload, 'modeExecution.stops', []).map(async (stop) => {
        const name = get(stop, 'location.name');
        const address1 = get(stop, 'location.address.address1');
        const cityName = get(stop, 'location.address.city');
        const state = get(stop, 'location.address.state');
        const zipCode = get(stop, 'location.address.zip');
        const country = get(stop, 'location.address.country');
        const referenceNumbers = references.map((ref) => ({
          __type: 'reference_number',
          __name: 'referenceNumbers',
          company_id: 'TMS',
          element_id: '128',
          partner_id: 'TMS',
          reference_number: get(ref, 'value'),
          reference_qual: get(referenceNumberMapping, get(ref, 'name'), get(ref, 'name')),
          send_to_driver: true,
          version: '004010',
        }));
        referenceNumbers.push({
          __type: 'reference_number',
          __name: 'referenceNumbers',
          company_id: 'TMS',
          element_id: '128',
          partner_id: 'TMS',
          reference_number: get(uberPayload, 'modeExecution.id', ''),
          reference_qual: 'IT',
          send_to_driver: true,
          version: '004010',
        });
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
          stopNotes: get(stop, 'comments', []).map((comment) => ({
            __name: 'stopNotes',
            __type: 'stop_note',
            company_id: 'TMS',
            comment_type: 'DC',
            comments: get(comment, 'value'),
          })),
          ...(get(stop, 'type') === 'PICKUP' && { referenceNumbers }),
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
