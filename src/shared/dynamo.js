'use strict';
const AWS = require('aws-sdk');

const db = new AWS.DynamoDB.DocumentClient();
const { get } = require('lodash');

async function Query(params) {
  try {
    const data = await dbRead(params);
    return data;
  } catch (e) {
    console.error('DynamoDb query error. ', ' Params: ', params, ' Error: ', e);
  }
}

async function dbRead(params) {
  async function helper(newParams) {
    const result = await db.query(newParams).promise();
    let data = result.Items;
    if (result.LastEvaluatedKey) {
      newParams.ExclusiveStartKey = result.LastEvaluatedKey;
      data = data.concat(await helper(newParams));
    }
    return data;
  }
  const readData = await helper(params);
  return { Items: readData };
}

async function Put(params) {
  try {
    const data = await db.put(params).promise();
    return data;
  } catch (e) {
    console.error('DynamoDb put error. ', ' Params: ', params, ' Error: ', e);
    throw e;
  }
}

async function dynamoInsert(tableName, data) {
  const dynamoInsertParams = {
    TableName: tableName,
    Item: data,
  };
  try {
    console.info(
      '🙂 -> file: dynamo.js:44 -> dynamoInsert -> dynamoInsertParams:',
      dynamoInsertParams
    );
    const response = await db.put(dynamoInsertParams).promise();
    return response;
  } catch (e) {
    console.error('DynamoDb put error. ', ' Params: ', dynamoInsertParams, ' Error: ', e);
    throw e;
  }
}

async function Update(params) {
  try {
    const data = await db.update(params).promise();
    return data;
  } catch (e) {
    console.error('DynamoDb update error. ', ' Params: ', params, ' Error: ', e);
    throw e;
  }
}

async function Get(params) {
  try {
    const data = await db.get(params).promise();
    return data;
  } catch (e) {
    console.error('DynamoDb get error. ', ' Params: ', params, ' Error: ', e);
    throw e;
  }
}

async function updateItem(params) {
  try {
    return await db.update(params).promise();
  } catch (e) {
    console.error('Update Item Error: ', e, '\nUpdate params: ', params);
    throw e;
  }
}

async function deleteItem(tableName, key) {
  let params;
  try {
    params = {
      TableName: tableName,
      Key: key,
    };
    return await db.delete(params).promise();
  } catch (e) {
    console.error('delete Item Error: ', e, '\ndelete params: ', params);
    throw e;
  }
}

async function Scan(params) {
  const scanResults = [];
  let items;
  try {
    do {
      items = await db.scan(params).promise();
      get(items, 'Items', []).forEach((item) => scanResults.push(item));
      params.ExclusiveStartKey = get(items, 'LastEvaluatedKey');
    } while (typeof items.LastEvaluatedKey !== 'undefined');
  } catch (e) {
    console.error('DynamoDb scan error. ', ' Params: ', params, ' Error: ', e);
    throw e;
  }
  return scanResults;
}

async function batchWriteItems(params) {
  return await db.batchWrite(params).promise();
}

function getQueryExpression(keys) {
  let expression = '';
  const expressionAtts = {};
  const expressionAttNames = {};
  Object.keys(keys).forEach((k) => {
    expression += `#${k}=:${k} and `;
    expressionAtts[`:${k}`] = keys[k];
    expressionAttNames[`#${k}`] = k;
  });
  expression = expression.substring(0, expression.lastIndexOf(' and '));
  return [expression, expressionAtts, expressionAttNames];
}

async function queryWithPartitionKey(tableName, key) {
  let params;
  try {
    const [expression, expressionAtts, expressionAttNames] = getQueryExpression(key);
    params = {
      TableName: tableName,
      KeyConditionExpression: expression,
      ExpressionAttributeNames: expressionAttNames,
      ExpressionAttributeValues: expressionAtts,
    };
    return await dbReadWithLastEvaluatedKey(params);
  } catch (e) {
    console.error('Query Item With Partition key Error: ', e, '\nGet params: ', params);
    throw e;
  }
}

async function dbReadWithLastEvaluatedKey(params) {
  async function helper(newParams) {
    const result = await db.query(newParams).promise();
    let data = result.Items;
    if (result.LastEvaluatedKey) {
      newParams.ExclusiveStartKey = result.LastEvaluatedKey;
      data = data.concat(await helper(newParams));
    }
    return data;
  }
  const readData = await helper(params);
  return { Items: readData };
}

async function queryWithIndex(tableName, index, keys, otherParams = null) {
  let params;
  try {
    const [expression, expressionAtts, expressionAttNames] = getQueryExpression(keys);
    params = {
      TableName: tableName,
      KeyConditionExpression: expression,
      IndexName: index,
      ExpressionAttributeNames: expressionAttNames,
      ExpressionAttributeValues: expressionAtts,
    };
    if (otherParams) params = { ...params, ...otherParams };
    return await db.query(params).promise();
  } catch (e) {
    console.error('Query Item Error: ', e, '\nQuery params: ', params);
    throw e;
  }
}

module.exports = {
  Query,
  Put,
  Update,
  Get,
  Scan,
  dbRead,
  deleteItem,
  batchWriteItems,
  updateItem,
  queryWithPartitionKey,
  queryWithIndex,
  dynamoInsert,
};
