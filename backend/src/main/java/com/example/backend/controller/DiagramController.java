package com.example.backend.controller;

import com.example.backend.entity.Diagram;
import com.example.backend.entity.ParticipantRole;
import com.example.backend.entity.User;
import com.example.backend.service.DiagramService;
import com.example.backend.service.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/diagrams")
public class DiagramController {

    private final DiagramService diagramService;
    private final UserService userService;

    @Autowired
    public DiagramController(DiagramService diagramService, UserService userService) {
        this.diagramService = diagramService;
        this.userService = userService;
    }

    @PostMapping
    public ResponseEntity<?> createDiagram(@RequestParam String name) {
        try {
            Long currentUserId = userService.getCurrentUser().getId();
            Diagram diagram = diagramService.createDiagram(name, currentUserId);
            return ResponseEntity.ok(diagram);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getDiagram(@PathVariable Long id) {
        try {
            Diagram diagram = diagramService.findById(id);
            return ResponseEntity.ok(diagram);
        } catch (Exception e) {
            return ResponseEntity.notFound().build();
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteDiagram(@PathVariable Long id) {
        try {
            diagramService.deleteDiagram(id);
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @GetMapping
    public ResponseEntity<?> getAllDiagrams() {
        try {
            Long currentUserId = userService.getCurrentUser().getId();
            List<Diagram> diagrams = diagramService.getMyDiagrams(currentUserId);
            return ResponseEntity.ok(diagrams);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
    @PostMapping("/{diagramId}/participants/{userId}")
    public ResponseEntity<?> addParticipant(@PathVariable Long diagramId,
                                            @PathVariable Long userId,
                                            @RequestParam ParticipantRole role) {
        try {
            Diagram diagram = diagramService.addParticipant(diagramId, userId, role);
            return ResponseEntity.ok(diagram);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }


    @DeleteMapping("/{diagramId}/participants/{userId}")
    public ResponseEntity<?> removeParticipant(@PathVariable Long diagramId,
                                               @PathVariable Long userId) {
        try {
            Diagram diagram = diagramService.removeParticipant(diagramId, userId);
            return ResponseEntity.ok(diagram);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }


    @GetMapping("/{diagramId}/participants")
    public ResponseEntity<?> getParticipants(@PathVariable Long diagramId) {
        try {
            List<User> participants = diagramService.getParticipants(diagramId);
            return ResponseEntity.ok(participants);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @GetMapping("/my")
    public ResponseEntity<?> getMyDiagrams() {
        try {
            Long currentUserId = userService.getCurrentUser().getId();
            List<Diagram> diagrams = diagramService.getMyDiagrams(currentUserId);
            return ResponseEntity.ok(diagrams);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateDiagram(@PathVariable Long id,
                                           @RequestBody Map<String, String> updates) {
        try {
            Long currentUserId = userService.getCurrentUser().getId();
            String name = updates.get("name");
            String description = updates.get("description");

            Diagram diagram = diagramService.updateDiagram(id, name, description, currentUserId);

            Map<String, Object> response = new HashMap<>();
            response.put("message", "Diagram updated successfully");
            response.put("id", diagram.getId());
            response.put("name", diagram.getName());
            response.put("description", diagram.getDescription());

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/{id}/access")
    public ResponseEntity<?> getUserRoleInDiagram(@PathVariable Long id) {
        try {
            Long currentUserId = userService.getCurrentUser().getId();
            ParticipantRole role = diagramService.getUserRoleInDiagram(id, currentUserId);

            if (role == null) {
                return ResponseEntity.status(403).body(Map.of("error", "Access denied"));
            }

            return ResponseEntity.ok(Map.of(
                    "role", role.name(),
                    "canEdit", role == ParticipantRole.OWNER || role == ParticipantRole.EDITOR
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}