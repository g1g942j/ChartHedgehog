package com.example.backend.websocket.dto;

import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
public class CollabOperationDto {
    private String userId;
    private String username;
    private String color;
    private List<Object> added;
    private List<Object> updated;
    private List<String> deletedIds;
}
