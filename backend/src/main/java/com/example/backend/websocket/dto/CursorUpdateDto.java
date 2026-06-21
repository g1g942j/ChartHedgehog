package com.example.backend.websocket.dto;

import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
public class CursorUpdateDto {
    private String userId;
    private String username;
    private String color;
    private double x;
    private double y;
}
