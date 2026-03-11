/**
 * Project: Smart Task Management
 * Layer: Entity (Database Model)
 * Component: User
 * Description: Represents the database schema for the component.
 */
package com.smarttask.activity.entity;

public enum ActivityAction {
    CARD_CREATED,
    CARD_UPDATED,
    CARD_LIST_CHANGED,
    CARD_ASSIGNED,
    MEMBER_ADDED,
    MEMBER_REMOVED
}
