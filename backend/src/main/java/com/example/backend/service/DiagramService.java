package com.example.backend.service;

import com.example.backend.dto.DiagramDetailDto;
import com.example.backend.dto.DiagramParticipantDto;
import com.example.backend.dto.DiagramSummaryDto;
import com.example.backend.entity.Diagram;
import com.example.backend.entity.DiagramParticipant;
import com.example.backend.entity.ParticipantRole;
import com.example.backend.entity.User;
import com.example.backend.repository.DiagramRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class DiagramService {

    private final DiagramRepository diagramRepository;
    private final UserService userService;

    @Autowired
    public DiagramService(DiagramRepository diagramRepository, UserService userService) {
        this.diagramRepository = diagramRepository;
        this.userService = userService;
    }


    @Transactional
    public Diagram createDiagram(String name, Long ownerId) {
        User owner = userService.findById(ownerId);
        Diagram diagram = new Diagram(name, owner);
        return diagramRepository.save(diagram);
    }

    @Transactional
    public DiagramSummaryDto createDiagramSummary(String name, Long ownerId) {
        Diagram d = createDiagram(name, ownerId);
        return toSummaryDto(d, ownerId);
    }

    public Diagram findById(Long id) {
        return diagramRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Diagram not found"));
    }

    @Transactional
    public void deleteDiagram(Long id) {
        diagramRepository.deleteById(id);
    }

    @Transactional
    public Diagram updateDiagram(Long id, String name, String description, Long userId) {
        Diagram diagram = findById(id);
        if (!hasAccess(id, userId, ParticipantRole.EDITOR)) {
            throw new RuntimeException("Access denied");
        }
        if (name != null && !name.isBlank()) {
            diagram.setName(name);
        }
        if (description != null) {
            diagram.setDescription(description);
        }
        return diagramRepository.save(diagram);
    }


    @Transactional(readOnly = true)
    public List<DiagramSummaryDto> getMyDiagramSummaries(Long userId) {
        User user = userService.findById(userId);
        List<Diagram> owned = diagramRepository.findByOwner(user);
        List<Diagram> participated = diagramRepository.findByParticipantUserId(userId);

        Set<Long> seen = new HashSet<>();
        List<DiagramSummaryDto> result = new ArrayList<>();
        for (Diagram d : owned) {
            if (seen.add(d.getId())) result.add(toSummaryDto(d, userId));
        }
        for (Diagram d : participated) {
            if (seen.add(d.getId())) result.add(toSummaryDto(d, userId));
        }
        return result;
    }


    @Transactional(readOnly = true)
    public DiagramDetailDto getDiagramDetail(Long id, Long requesterId) {
        Diagram diagram = findById(id);
        if (requesterId == null) {
            if (!Boolean.TRUE.equals(diagram.getIsPublic())) {
                throw new RuntimeException("Access denied");
            }
            return toDetailDto(diagram, null);
        }
        if (getUserRoleInDiagram(diagram, requesterId) == null) {
            throw new RuntimeException("Access denied");
        }
        return toDetailDto(diagram, requesterId);
    }


    @Transactional(readOnly = true)
    public String[] getContent(Long id, Long requesterId) {
        Diagram d = findById(id);
        if (requesterId == null) {
            if (!Boolean.TRUE.equals(d.getIsPublic())) {
                throw new RuntimeException("Access denied");
            }
        } else if (getUserRoleInDiagram(d, requesterId) == null) {
            throw new RuntimeException("Access denied");
        }
        return new String[]{
                d.getContent() != null ? d.getContent() : "",
                d.getTemplate() != null ? d.getTemplate() : ""
        };
    }

    @Transactional
    public void setPublic(Long id, boolean isPublic, Long requesterId) {
        Diagram diagram = findById(id);
        if (!diagram.getOwner().getId().equals(requesterId)) {
            throw new RuntimeException("Only owner can change visibility");
        }
        diagram.setIsPublic(isPublic);
        diagramRepository.save(diagram);
    }

    @Transactional
    public void updateContent(Long id, String content, String template, String preview, Long userId) {
        Diagram diagram = findById(id);
        if (!hasAccess(id, userId, ParticipantRole.EDITOR)) {
            throw new RuntimeException("Access denied");
        }
        diagram.setContent(content);
        diagram.setTemplate(template);
        diagram.setPreview(preview);
        diagramRepository.save(diagram);
    }


    @Transactional
    public DiagramSummaryDto cloneDiagram(Long id, Long newOwnerId) {
        Diagram source = findById(id);
        if (getUserRoleInDiagram(source, newOwnerId) == null) {
            throw new RuntimeException("Access denied");
        }
        User newOwner = userService.findById(newOwnerId);
        Diagram clone = new Diagram(source.getName() + " (копия)", newOwner);
        clone.setContent(source.getContent());
        clone.setTemplate(source.getTemplate());
        Diagram saved = diagramRepository.save(clone);
        return toSummaryDto(saved, newOwnerId);
    }


    @Transactional
    public void addParticipant(Long diagramId, Long userId, ParticipantRole role) {
        Diagram diagram = findById(diagramId);
        User user = userService.findById(userId);

        boolean alreadyParticipant = diagram.getParticipantRoles().stream()
                .anyMatch(p -> p.getUser().getId().equals(userId));
        if (alreadyParticipant || diagram.getOwner().getId().equals(userId)) {
            throw new RuntimeException("User is already a participant");
        }

        diagram.getParticipantRoles().add(new DiagramParticipant(diagram, user, role));
        diagramRepository.save(diagram);
    }

    @Transactional
    public void removeParticipant(Long diagramId, Long userId) {
        Diagram diagram = findById(diagramId);
        diagram.getParticipantRoles().removeIf(p -> p.getUser().getId().equals(userId));
        diagramRepository.save(diagram);
    }

    @Transactional(readOnly = true)
    public List<DiagramParticipantDto> getParticipantDtos(Long diagramId, Long requesterId) {
        Diagram diagram = findById(diagramId);
        if (requesterId == null) {
            if (!Boolean.TRUE.equals(diagram.getIsPublic())) {
                throw new RuntimeException("Access denied");
            }
        } else if (getUserRoleInDiagram(diagram, requesterId) == null) {
            throw new RuntimeException("Access denied");
        }
        List<DiagramParticipantDto> result = new ArrayList<>();
        User owner = diagram.getOwner();
        result.add(new DiagramParticipantDto(
                owner.getId(), owner.getUsername(), owner.getEmail(), owner.getFullName(), "OWNER"));
        for (DiagramParticipant p : diagram.getParticipantRoles()) {
            User u = p.getUser();
            if (!u.getId().equals(owner.getId())) {
                result.add(new DiagramParticipantDto(
                        u.getId(), u.getUsername(), u.getEmail(), u.getFullName(), p.getRole().name()));
            }
        }
        return result;
    }

    @Transactional
    public void updateParticipantRole(Long diagramId, Long participantUserId,
                                      ParticipantRole newRole, Long requesterId) {
        Diagram diagram = findById(diagramId);
        if (!diagram.getOwner().getId().equals(requesterId)) {
            throw new RuntimeException("Only owner can change roles");
        }
        DiagramParticipant p = diagram.getParticipantRoles().stream()
                .filter(dp -> dp.getUser().getId().equals(participantUserId))
                .findFirst()
                .orElseThrow(() -> new RuntimeException("Participant not found"));
        p.setRole(newRole);
        diagramRepository.save(diagram);
    }


    public boolean hasAccess(Long diagramId, Long userId, ParticipantRole requiredRole) {
        Diagram diagram = findById(diagramId);
        String role = getUserRoleInDiagram(diagram, userId);
        if (role == null) return false;
        if (role.equals("OWNER")) return true;
        if (requiredRole == ParticipantRole.VIEWER) return true;
        if (requiredRole == ParticipantRole.EDITOR) return role.equals("EDITOR");
        return false;
    }

    public ParticipantRole getUserRoleInDiagram(Long diagramId, Long userId) {
        Diagram diagram = findById(diagramId);
        String role = getUserRoleInDiagram(diagram, userId);
        if (role == null) return null;
        return ParticipantRole.valueOf(role);
    }


    private String getUserRoleInDiagram(Diagram d, Long userId) {
        if (d.getOwner().getId().equals(userId)) return "OWNER";
        return d.getParticipantRoles().stream()
                .filter(p -> p.getUser().getId().equals(userId))
                .map(p -> p.getRole().name())
                .findFirst()
                .orElse(null);
    }

    private DiagramSummaryDto toSummaryDto(Diagram d, Long currentUserId) {
        String role = getUserRoleInDiagram(d, currentUserId);
        return new DiagramSummaryDto(
                d.getId(), d.getName(), d.getDescription(),
                d.getCreatedAt() != null ? d.getCreatedAt().toString() : null,
                d.getUpdatedAt() != null ? d.getUpdatedAt().toString() : null,
                d.getOwner().getUsername(),
                role != null ? role : "VIEWER",
                d.getPreview()
        );
    }

    private DiagramDetailDto toDetailDto(Diagram d, Long currentUserId) {
        String role = currentUserId != null ? getUserRoleInDiagram(d, currentUserId) : null;
        return new DiagramDetailDto(
                d.getId(), d.getName(), d.getDescription(),
                d.getCreatedAt() != null ? d.getCreatedAt().toString() : null,
                d.getUpdatedAt() != null ? d.getUpdatedAt().toString() : null,
                d.getOwner().getId(), d.getOwner().getUsername(),
                role != null ? role : "VIEWER",
                d.getIsPublic()
        );
    }
}
