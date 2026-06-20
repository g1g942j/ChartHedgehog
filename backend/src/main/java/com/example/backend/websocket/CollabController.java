package com.example.backend.websocket;

import com.example.backend.repository.UserRepository;
import com.example.backend.websocket.dto.CollabOperationDto;
import com.example.backend.websocket.dto.CursorUpdateDto;
import com.example.backend.websocket.dto.PresenceEventDto;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.security.Principal;

@Controller
public class CollabController {

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    @Autowired
    private UserRepository userRepository;

    @MessageMapping("/diagram/{id}/operation")
    public void handleOperation(@DestinationVariable String id,
                                @Payload CollabOperationDto op,
                                Principal principal) {
        if (principal == null) return;
        op.setUserId(resolveUserId(principal));
        op.setUsername(principal.getName());
        op.setColor(colorFor(principal.getName()));
        messagingTemplate.convertAndSend("/topic/diagram/" + id, op);
    }

    @MessageMapping("/diagram/{id}/cursor")
    public void handleCursor(@DestinationVariable String id,
                             @Payload CursorUpdateDto cursor,
                             Principal principal) {
        if (principal == null) return;
        cursor.setUserId(resolveUserId(principal));
        cursor.setUsername(principal.getName());
        cursor.setColor(colorFor(principal.getName()));
        messagingTemplate.convertAndSend("/topic/diagram/" + id + "/cursors", cursor);
    }

    @MessageMapping("/diagram/{id}/join")
    public void handleJoin(@DestinationVariable String id,
                           @Payload PresenceEventDto event,
                           Principal principal) {
        if (principal == null) return;
        event.setType("join");
        event.setUserId(resolveUserId(principal));
        event.setUsername(principal.getName());
        event.setColor(colorFor(principal.getName()));
        messagingTemplate.convertAndSend("/topic/diagram/" + id + "/presence", event);
    }

    @MessageMapping("/diagram/{id}/leave")
    public void handleLeave(@DestinationVariable String id,
                            @Payload PresenceEventDto event,
                            Principal principal) {
        if (principal == null) return;
        event.setType("leave");
        event.setUserId(resolveUserId(principal));
        event.setUsername(principal.getName());
        event.setColor(colorFor(principal.getName()));
        messagingTemplate.convertAndSend("/topic/diagram/" + id + "/presence", event);
    }

    private String resolveUserId(Principal principal) {
        return userRepository.findByUsername(principal.getName())
                .map(u -> String.valueOf(u.getId()))
                .orElse(principal.getName());
    }

    private String colorFor(String username) {
        String[] palette = {
                "#E91E63", "#9C27B0", "#3F51B5", "#2196F3", "#00BCD4",
                "#009688", "#4CAF50", "#FF5722", "#795548", "#607D8B"
        };
        return palette[Math.abs(username.hashCode()) % palette.length];
    }
}
