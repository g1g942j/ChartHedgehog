package com.example.backend.controller;

import com.example.backend.dto.DiagramDetailDto;
import com.example.backend.dto.DiagramParticipantDto;
import com.example.backend.dto.DiagramSummaryDto;
import com.example.backend.entity.ParticipantRole;
import com.example.backend.service.DiagramService;
import com.example.backend.service.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

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

    @GetMapping("/my")
    public ResponseEntity<?> getMyDiagrams() {
        try {
            Long uid = userService.getCurrentUser().getId();
            List<DiagramSummaryDto> list = diagramService.getMyDiagramSummaries(uid);
            return ResponseEntity.ok(list);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping
    public ResponseEntity<?> createDiagram(@RequestBody Map<String, String> body) {
        try {
            String name = body.get("name");
            if (name == null || name.isBlank()) {
                return ResponseEntity.badRequest().body(Map.of("error", "Name is required"));
            }
            Long uid = userService.getCurrentUser().getId();
            DiagramSummaryDto dto = diagramService.createDiagramSummary(name.trim(), uid);
            return ResponseEntity.ok(dto);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getDiagram(@PathVariable Long id) {
        try {
            var user = userService.getCurrentUserOrNull();
            Long uid = user != null ? user.getId() : null;
            DiagramDetailDto dto = diagramService.getDiagramDetail(id, uid);
            return ResponseEntity.ok(dto);
        } catch (Exception e) {
            return ResponseEntity.status(404).body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/{id}/public")
    public ResponseEntity<?> setPublic(@PathVariable Long id,
                                       @RequestBody Map<String, Object> body) {
        try {
            Long uid = userService.getCurrentUser().getId();
            Object val = body.get("isPublic");
            if (!(val instanceof Boolean)) {
                return ResponseEntity.badRequest().body(Map.of("error", "isPublic (boolean) required"));
            }
            diagramService.setPublic(id, (Boolean) val, uid);
            return ResponseEntity.noContent().build();
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateDiagram(@PathVariable Long id,
                                           @RequestBody Map<String, String> updates) {
        try {
            Long uid = userService.getCurrentUser().getId();
            diagramService.updateDiagram(id, updates.get("name"), updates.get("description"), uid);
            return ResponseEntity.ok(diagramService.getDiagramDetail(id, uid));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteDiagram(@PathVariable Long id) {
        try {
            diagramService.deleteDiagram(id);
            return ResponseEntity.noContent().build();
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/{id}/clone")
    public ResponseEntity<?> cloneDiagram(@PathVariable Long id) {
        try {
            Long uid = userService.getCurrentUser().getId();
            DiagramSummaryDto dto = diagramService.cloneDiagram(id, uid);
            return ResponseEntity.ok(dto);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/{id}/content")
    public ResponseEntity<?> getContent(@PathVariable Long id) {
        try {
            var user = userService.getCurrentUserOrNull();
            Long uid = user != null ? user.getId() : null;
            String[] contentAndTemplate = diagramService.getContent(id, uid);
            return ResponseEntity.ok(Map.of(
                    "content", contentAndTemplate[0],
                    "template", contentAndTemplate[1]
            ));
        } catch (Exception e) {
            return ResponseEntity.status(403).body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/{id}/content")
    public ResponseEntity<?> saveContent(@PathVariable Long id,
                                         @RequestBody Map<String, String> body) {
        try {
            Long uid = userService.getCurrentUser().getId();
            diagramService.updateContent(
                    id,
                    body.get("content"),
                    body.get("template"),
                    body.get("preview"),
                    uid
            );
            return ResponseEntity.noContent().build();
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/{id}/participants")
    public ResponseEntity<?> getParticipants(@PathVariable Long id) {
        try {
            Long uid = userService.getCurrentUser().getId();
            List<DiagramParticipantDto> list = diagramService.getParticipantDtos(id, uid);
            return ResponseEntity.ok(list);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/{diagramId}/participants/{userId}")
    public ResponseEntity<?> addParticipant(@PathVariable Long diagramId,
                                            @PathVariable Long userId,
                                            @RequestBody Map<String, String> body) {
        try {
            ParticipantRole role = ParticipantRole.valueOf(
                    body.getOrDefault("role", "VIEWER").toUpperCase());
            diagramService.addParticipant(diagramId, userId, role);
            return ResponseEntity.noContent().build();
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid role"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/{diagramId}/participants/{userId}")
    public ResponseEntity<?> removeParticipant(@PathVariable Long diagramId,
                                               @PathVariable Long userId) {
        try {
            diagramService.removeParticipant(diagramId, userId);
            return ResponseEntity.noContent().build();
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/{diagramId}/participants/{userId}/role")
    public ResponseEntity<?> updateParticipantRole(@PathVariable Long diagramId,
                                                   @PathVariable Long userId,
                                                   @RequestBody Map<String, String> body) {
        try {
            Long requesterId = userService.getCurrentUser().getId();
            ParticipantRole newRole = ParticipantRole.valueOf(
                    body.get("role").toUpperCase());
            diagramService.updateParticipantRole(diagramId, userId, newRole, requesterId);
            return ResponseEntity.noContent().build();
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid role"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
