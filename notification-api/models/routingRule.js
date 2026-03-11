'use strict';
const {
  Model,
  DataTypes
} = require('sequelize');

module.exports = (sequelize, schemaName) => {
  class RoutingRule extends Model {
    static associate(models) {
      // define association here
    }
  }

  RoutingRule.init({
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },

    service: {
      type: DataTypes.ENUM("SMS", "EMAIL", "SLACK","WHATSAPP"),
      allowNull: false
    },

    provider: {
      type: DataTypes.STRING,
      allowNull: false
    },

    match_key: {
      type: DataTypes.STRING,
      allowNull: false
    },

    match_value: {
      type: DataTypes.STRING,
      allowNull: false
    },

    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'created_at'
    },

    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'updated_at'
    },

    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'deleted_at'
    }

  }, {
    sequelize,
    modelName: 'RoutingRule',
    tableName: 'routing_rules',
    schema: schemaName.toLowerCase(),
    timestamps: true,
    underscored: true,
    paranoid: true,

    indexes: [
      {
        unique: true,
        fields: ['service', 'match_value']
      }
    ]
  });

  return RoutingRule;
};