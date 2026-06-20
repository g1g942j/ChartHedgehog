package com.example.backend.websocket.dto;

import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
public class PresenceEventDto {
    private String type;
    private String userId;
    private String username;
    private String color;
}
